# MUSD Pocket v3: design (not yet implemented)

Goal: make a locked goal *reduce* loan risk and earn something, instead of sitting idle.
This is the design to build and review. It is deliberately not Solidity yet: the Mezo
interfaces below are unverified, and the earlier security review
(`docs/SECURITY_REVIEW.md`, item 3) says vault routing needs its own review first.

## 1. Facts to verify before writing code

| # | Question | How to check |
|---|----------|--------------|
| 1 | Does `BorrowerOperationsSignatures.repayMUSDWithSignature` exist? Whose MUSD is burned: borrower, `_recipient`, or `msg.sender`? | Read `mezo-org/musd` `BorrowerOperationsSignatures.sol` and its tests; call on a mainnet fork. |
| 2 | Is the sMUSD vault (`0xb4D498029af77680cD1eF828b967f010d06C51CC`) a standard ERC-4626? Does `deposit`, `redeem`, `previewRedeem` work, can it pause, is there a withdrawal delay or fee? | Fork test against mainnet; read verified source. |
| 3 | Is `BorrowerOperations.minNetDebt()` public? (PR #12 falls back to 1,800 if the read fails.) | `cast call` on testnet and mainnet. |
| 4 | Stability Pool: deposit/withdraw interface, gains in BTC (needs `receive`), and loss on liquidation absorption. | Read source. Probably out of scope for v3: gains are in BTC, and the pool can lose principal. |

Recommendation: ship **sMUSD routing + self-repay** in v3, and leave the Stability Pool for later.

## 2. Productive locked MUSD (sMUSD vault, opt-in per goal)

- A goal chooses at creation (or later, via `moveToVault(goalId)`) whether its balance sits in the vault. Default is off.
- Accounting is in **shares**, not assets. `goalShares[goalId]`, `totalShares`, and the invariant
  `sum(goalShares) == vault.balanceOf(pocket)` (fork + invariant test).
- Deposit: measure the **share balance delta**, never trust a return value.
- Yield goes to the goal owner through the rising share price. The fee pool takes nothing from yield.
- Exit: `exitVault(goalId)` by the goal owner redeems that goal's shares to MUSD at any time (no unlock needed, no early fee: it is a move, not a withdrawal). If the vault reverts or is paused, only vault goals are stuck; non-vault goals are unaffected.
- Admin can never touch shares or vault assets. Rounding is rounded down on redeem and borne by the goal.
- Exposure cap: `maxVaultBps` of `totalLocked` (start at 50%) so a vault failure cannot freeze every goal.
- Early-exit fee is computed on assets (`previewRedeem`) at withdrawal time.

## 3. Emergency self-repay (the lock reduces loan risk)

`repayTroveFromGoal(goalId, amount, upperHint, lowerHint, signature, deadline)`

- Only the goal owner, who must also be the trove borrower (`msg.sender`).
- Allowed only when the trove is at risk: `ICR < EMERGENCY_ICR` (start at 1.7e18) or the system is in Recovery Mode.
- No early-exit fee on this path, because the funds go to the user's own loan. This is the abuse risk, so it needs all of: the ICR gate above, the money must actually burn against that trove (balance delta == amount), and `ICR after > ICR before`.
- Cannot take debt under `minNetDebt + gas compensation`. Above that, the UI offers "close loan" instead.
- Order: check, then decrease `goal.balance` and `totalLocked`, then call Mezo, then verify the delta and the new ICR, and revert everything otherwise. `nonReentrant` as in v2.
- If fact #1 shows the signature path cannot burn Pocket-held MUSD for the borrower's trove, fall back to: release the goal's MUSD to the owner with no fee only when the ICR gate holds, and have the UI send the repay in the same flow. This is weaker (not atomic) and must be labelled that way.

## 4. Tests required before any deploy

- Foundry unit tests for both paths, including rounding, paused vault, reverting vault, and a vault that returns fewer shares than expected.
- Invariants: `totalLocked + feePool <= assets held + vault assets`; shares sum equals vault balance; admin cannot move goal funds.
- Mainnet **fork** tests against the real sMUSD vault and Mezo contracts. The mocks in `src/mocks` are not enough.
- A fresh review of items in `SECURITY_REVIEW.md` section 3 (share accounting, paused vault, who gets the yield, withdraw while the vault is down).

## 5. Deploy order

1. Merge PR #12 (frontend fixes).
2. Resolve section 1, write v3, pass section 4.
3. Deploy v3 to testnet, then outside testers.
4. Mainnet with a small per-goal and total deposit cap, owner = multisig.
