# Security review: MUSDPocket.sol

**Scope:** `contracts/src/MUSDPocket.sol` (283 lines), as deployed on Mezo testnet at
[`0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8`](https://explorer.test.mezo.org/address/0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8).
**Date:** 21 Oct 2026. **Reviewer:** the builder, using Slither plus a manual, AI-assisted line-by-line review.
**This is not a professional audit.** It is the self-review the Mezo team asked builders to do before
submitting. A mainnet launch needs an external review on top of it (see the last section).

**Deployed code = reviewed code.** The on-chain runtime bytecode matches a local `forge build` of this
source byte for byte, including the metadata hash (solc 0.8.28, optimizer 200 runs, EVM `london`).
The source is verified on the Mezo testnet explorer (Blockscout: "Pass - Verified").
The contract was not changed or redeployed during this review. The fixes listed below are planned for the
mainnet version.

## Summary

| ID | Title | Severity | Status |
|---|---|---|---|
| M-1 | Owner can change the early-exit fee for existing goals (capped at 5%) | Medium | Acknowledged. Fix planned for mainnet |
| M-2 | Single-key owner, one-step ownership transfer | Medium (centralisation) | Acknowledged. Multisig + 2-step planned for mainnet |
| L-1 | `deposit` writes state after the external `transferFrom` (Slither `reentrancy-no-eth`) | Low | Not exploitable with MUSD. Reorder planned |
| L-2 | `createGoal` with a past `unlockTime` reverts with an arithmetic panic, not `BadLock` | Low (UX) | Acknowledged |
| L-3 | Raw `transfer`/`transferFrom` with bool check instead of SafeERC20; amount credited, not balance delta | Low | Safe for canonical MUSD. Hardening planned |
| L-4 | Shared-goal contributions become the goal owner's funds | Low (trust model) | By design. Now explained in the UI copy |
| I-1 | No pause, no rescue for tokens sent to the contract directly | Info | Acknowledged |
| I-2 | Timestamp dependence (Slither `timestamp`) | Info | Accepted: day-scale locks |
| I-3 | Events emitted after external calls (Slither `reentrancy-events`) | Info | Accepted |
| I-4 | Fee rounds down to 0 for tiny balances; memo errors reuse `EmptyName`; memos are public | Info | Acknowledged |

Nothing found lets a third party take a user's goal balance, or lets the owner take goal principal.

## Tools and results

**Slither 0.11.6** (`slither . --filter-paths "lib/|test/|script/|mocks/"`), 102 detectors, **9 results**
(raw output: [`slither-output.txt`](./slither-output.txt)):

| Detector | Impact | Count | Assessment |
|---|---|---|---|
| `reentrancy-no-eth` | Medium | 1 | `deposit`: `g.balance += amount` after `musd.transferFrom`. See L-1. |
| `reentrancy-events` | Low | 5 | Events emitted after transfers in `deposit`, `withdraw`, `earlyWithdraw`, `sendRemittance`, `claimFees`. See I-3. |
| `timestamp` | Low | 3 | `block.timestamp` comparisons for lock windows. See I-2. |

No High findings. No `arbitrary-send-erc20`, unchecked-transfer, uninitialised-state, or access-control
findings.

**Foundry tests:** 24/24 pass (`forge test`), up from 11:
- `test/MUSDPocket.t.sol` (11, original): goal lifecycle, fees, shared goals, memo payment, fuzzed deposit/withdraw.
- `test/MUSDPocket.security.t.sol` (13, new, contract unchanged):
  - fee cap at 5% (unit + fuzz) and `onlyOwner` on all admin functions;
  - `claimFees` can take only the fee pool, never principal;
  - M-1 retroactive fee behaviour, pinned so it is visible;
  - only the goal owner can withdraw, including on shared goals;
  - a removed contributor or a stranger cannot deposit;
  - `sendRemittance` can't spend another user's allowance;
  - closed goals can't be reused;
  - lock bounds at exactly 1 day and 730 days;
  - a fuzzed accounting invariant: the contract's MUSD balance always equals the sum of open goal balances plus `feePool`.

On-chain, the same invariant holds after the real activity in [`onchain-activity.md`](./onchain-activity.md):
842 MUSD held = 250 + 240 + 350 (goals) + 2 (fee pool).

## Findings

### M-1: Owner can change the early-exit fee for existing goals (capped at 5%)
`earlyWithdraw` reads the global `earlyFeeBps` at exit time. The owner can call `setEarlyFeeBps` at any time,
so a user who locked at 2% may pay up to 5% when they exit. The owner could also front-run a specific
early withdrawal. Impact is bounded: `MAX_EARLY_FEE_BPS = 500` is a hard-coded constant, the fee applies
only to early exits (an on-time `withdraw` pays nothing), and `EarlyFeeUpdated` is emitted.
Test: `test_feeChange_appliesRetroactively_boundedByCap`.
**Mainnet fix:** store `feeBps` in the `Goal` struct at creation and charge that rate. Optionally put fee changes
behind a timelock.

### M-2: Single-key owner, one-step ownership transfer
`owner` can set the fee (≤5%), claim `feePool`, and transfer ownership. On testnet the owner is the deployer
hot key. `transferOwnership` is one-step, so a typo would permanently lose admin rights. User funds would not
be affected, but fees would be unclaimable.
What the owner **cannot** do: move goal balances, change lock dates, pause withdrawals or upgrade the
contract. The contract is not a proxy and `musd` is `immutable`. `claimFees` zeroes and pays out only the
`feePool` counter, which only `earlyWithdraw` increases. Test: `test_claimFees_cannotTouchPrincipal`.
**Mainnet fix:** owner = Safe multisig, `Ownable2Step`-style accept, and a published fee-treasury policy.

### L-1: State written after the external call in `deposit`
`withdraw` and `earlyWithdraw` follow checks-effects-interactions: the balance is zeroed and the goal closed
before the transfer. `deposit` credits `g.balance` after `transferFrom`. This is not exploitable here.
`musd` is immutable and fixed to canonical MUSD. The testnet MUSD (`0x1189…c503`) is a verified, non-proxy
ERC-20 with no transfer hooks, so there is no callback into the Pocket. Even with a callback, re-entering
`deposit` would only credit amounts that were actually transferred.
**Mainnet fix:** move the credit above the call and add OpenZeppelin `ReentrancyGuard` to
deposit/withdraw/earlyWithdraw/claimFees as defence in depth.

### L-2: Past `unlockTime` reverts with a panic
`uint256(unlockTime) - block.timestamp` is evaluated before the `unlockTime <= block.timestamp` check, so a past
date reverts with `Panic(0x11)` instead of `BadLock()`. The behaviour is safe, but wallets show an unhelpful error.
The app always sends a future date (minimum 1 day). Test: `test_pastUnlock_reverts`.
**Mainnet fix:** check `unlockTime > block.timestamp` before subtracting.

### L-3: Token transfer handling
All five token movements use `if (!musd.transfer(...)) revert TransferFailed()`. That is correct for MUSD,
which returns `true` and reverts on failure. It would not support tokens that return no value. `deposit`
credits the requested `amount` rather than the balance delta, which would be wrong for fee-on-transfer tokens.
MUSD is not one, and the token address is immutable. `sendRemittance` and `deposit` always pull from
`msg.sender`, so an allowance a user gives the Pocket can't be spent by anyone else
(`test_remittance_cannotSpendSomeoneElsesAllowance`). The contract has no `receive`/`fallback`, so native BTC
sent to it reverts.
**Mainnet fix:** use `SafeERC20` (`safeTransfer`/`safeTransferFrom`). Keep the immutable single-token design.

### L-4: Shared-goal trust model
On a shared ("family") goal, allowlisted contributors can deposit, but only the goal owner can withdraw.
Contributors give their MUSD to the owner's goal and keep no claim on it. Removing a contributor doesn't refund
them. This is intended (a group gift or pooled savings), but it must be clear to users. The app copy says
contributions go to the goal owner.
**Possible v2:** per-contributor accounting with refunds if a goal is broken early.

### Informational
- **I-1:** No `pause`, by design: the owner has no power over user funds. MUSD sent directly to the contract
  (not via `deposit`) is stuck because there is no rescue function. A mainnet version could add
  `rescue(token, amount)` limited to `balance - (sum of goals + feePool)`, which needs a tracked total.
- **I-2:** Locks are 1 day to 2 years, so validator timestamp drift of a few seconds on Mezo's CometBFT
  chain does not matter.
- **I-3:** Events after calls only affect off-chain ordering if a token re-entered, which MUSD doesn't.
- **I-4:** `fee = amount * bps / 10_000` rounds down: balances under 50 wei pay no fee (negligible).
  Over-long memos revert with `EmptyName` (misleading name). Memos are public on-chain; the UI says so.
  `_goalsByOwner` grows without bound, but it is only read by the `goalsOf` view.

## Before mainnet (Wave 2 checklist)

1. Per-goal fee snapshot (M-1), `Ownable2Step` + Safe multisig owner (M-2).
2. CEI in `deposit` + `ReentrancyGuard` (L-1). Check order in `createGoal` (L-2). `SafeERC20` (L-3).
3. If goal balances are routed into the MUSD Savings Rate vault for yield, re-review from scratch:
   - share accounting and rounding;
   - vault pause/withdraw limits;
   - who receives the yield;
   - a withdraw path that works even when the vault does not.
4. Invariant tests with Foundry `invariant_` handlers, plus a second tool (Aderyn or Mythril).
5. An external review (an independent auditor or a Mezo-recommended reviewer) with time to fix findings,
   as the Mezo team advised at the kickoff.
6. Verify the mainnet deployment on the explorer and publish the owner address and fee policy.
