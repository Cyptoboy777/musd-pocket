# Security review: MUSDPocketV2

**Scope:** `contracts/src/MUSDPocketV2.sol` as of this commit. The verified Mezo testnet deployment [`0xEC03F758219746b6e773f107a05cF17b66E7D460`](https://explorer.test.mezo.org/address/0xEC03F758219746b6e773f107a05cF17b66E7D460) was built from git `2c5bd9b` and does **not** include the fee snapshot or two-step ownership described below. Mezo mainnet has no Pocket deployment. The live app is https://musd-pocket-mezo.vercel.app and it writes only to that testnet address.

**Reviewer:** the builder, with Slither 0.11.6 and Foundry tests. **This is not an independent audit.** It is our own pass before a mainnet deploy. An outside reviewer should still read the source that actually gets deployed.

Wave 1 `MUSDPocket.sol` (`0x2d5f…A1C8`) is unchanged. Slither still reports `reentrancy-no-eth` on its `deposit`. We left that file alone so it still matches the verified Wave 1 bytecode. We will not deploy it again.

## Summary

| ID | Title | Severity | Status in this source |
|---|---|---|---|
| M-1 | Early-exit fee could change under an open goal | Medium | Fixed in source. `goalEarlyFeeBps` is stored in `createGoal`. `setEarlyFeeBps` applies only to goals created later. Not in the verified testnet bytecode. |
| M-2 | Single-step owner, and the deployer key would have been owner | Medium | Fixed in source. `transferOwnership` sets `pendingOwner`. `acceptOwnership` completes it. Deploy scripts require `POCKET_OWNER` and do not default to the deployer. No multisig is chosen yet, and nothing is deployed with this code. |
| L-1 | `deposit` credited after `transferFrom` | Low | Fixed in source for v2. Credit happens before the pull. `nonReentrant` blocks the callback. A failing pull reverts the credit. |
| V2-B | `borrowToGoal` reads MUSD balance before the Mezo call and compares it after | Medium (Slither `reentrancy-balance`) | Reviewed. Kept on purpose. See below. |
| I-1 | `recoverStray` reverts when the stray amount is 0 (`incorrect-equality`) | Info | Accepted. It is an empty-check, not a balance used to size a payment. |
| I-2 | `receive()` looks like it can lock BTC (`locked-ether`) | Info | False positive. `msg.value != 0` reverts. Mezo's ActivePool makes a value-0 call, which we accept. |
| I-3 | `block.timestamp` for lock windows | Info | Accepted. Locks are 1 to 730 days. |
| I-4 | Low-level `call` for MUSD transfer | Info | Accepted. We check the boolean and any return data. MUSD is the immutable token. |

Nothing in this pass lets a third party take a goal balance, or lets the owner take goal principal. The owner can still set the fee for new goals (max 5%), claim `feePool`, and recover stray MUSD.

## Slither

Command, from `contracts/`:

```bash
slither src/MUSDPocketV2.sol --filter-paths "lib/|test/|script/|mocks/"
```

Slither 0.11.6, 102 detectors, **8 results**. Raw output: [slither-output-v2.txt](slither-output-v2.txt).

| Detector | Results | What we did |
|---|---|---|
| `reentrancy-balance` | 1 | `borrowToGoal`. Reviewed, not removed. |
| `incorrect-equality` | 1 | `recoverStray` empty check. Accepted. |
| `locked-ether` | 1 | `receive()` reverts on nonzero value. False positive. |
| `timestamp` | 3 | Lock windows. Accepted. |
| `low-level-calls` | 2 | Token pull and send. Accepted. |

`reentrancy-no-eth` does not fire on v2 `deposit`, `depositWithPermit`, or `borrowToGoal`. `reentrancy-benign` does not fire either. Both used to, because we wrote `goals`, `totalLocked`, and `totalBorrowedToGoals` after the external call. Those writes now happen first. If the token pull, the permit, or the Mezo borrow fails its check, the transaction reverts and the writes roll back.

A project-wide Slither run still reports `reentrancy-no-eth` on `MUSDPocket.sol` (v1) only.

## borrowToGoal

Mezo's `withdrawMUSDWithSignature` does not return how much MUSD arrived. We read `musd.balanceOf` before the call and require the delta to equal `amount`. That is the `reentrancy-balance` finding: Slither calls the saved balance stale if the callee can reenter.

What has to go wrong for that to pay out:

1. `borrowerOpsSig` is an immutable address, set to Mezo's signatures contract.
2. The function is `nonReentrant`. A callback into `deposit`, `withdraw`, `earlyWithdraw`, `borrowToGoal`, `claimFees`, or `recoverStray` hits `Reentrant` and the whole borrow reverts. We tested a token that reenters `deposit` and `withdraw` from `transferFrom`.
3. If the delta is not `amount`, we revert `BorrowMismatch`. A callback that stuffed extra MUSD into the contract would fail that check.
4. After the delta check we read the trove ICR and revert `LoanTooRisky` under 150%. That revert also rolls back the credit.

ActivePool sends a value-0 call to the recipient. `receive()` allows that and rejects real BTC. The tests cover a value-0 call and a 1-wei call.

We do not treat this as a clean bill of health. The balance check trusts that the MUSD token's `balanceOf` moves only when MUSD actually moves. Canonical MUSD has no transfer hook. A replaced `borrowerOpsSig` would be a different deployment, because the address is immutable.

## Tests

`forge test` on a clean clone (Forge 1.9.0): **58 passed, 0 failed, 1 skipped**. The skip is `MainnetPreflightTest`, which forks mainnet only when `MEZO_MAINNET_RPC` is set and does not deploy. `npm test` is **56 passed**, and `npm run build` passes.

Coverage we added for this pass:

- `test_feeSnapshot_ignoresLaterFeeChange` and `testFuzz_feeSnapshot_bounded`: an open goal keeps the fee from `createGoal`.
- `test_ownership_twoStep` and `test_ownership_pendingCanBeReplaced`: the owner does not change until `acceptOwnership`. A stranger cannot accept. The zero address is rejected.
- `test_deposit_callbackCannotReenter` and `test_deposit_callbackCannotWithdrawEarlyCredit`.
- `MUSDPocketV2InvariantTest`: 40 runs, depth 20. `invariant_solvent` keeps the MUSD balance at least `totalLocked + feePool` with no stray balance. `invariant_openGoalKeepsCreationFee` keeps the snapshotted fee inside the 5% cap.
- `DeployV2MainnetTest`: the script reverts on a zero owner and on the wrong chain, before it can deploy. Creation gas is `lastFrameGas().gasTotalUsed` on the CREATE, and it has to sit between 500,000 and 4,000,000. `gasleft()` in the caller is not that number.

## Before a mainnet transaction

1. Deploy from this source, not from `2c5bd9b`, with `POCKET_OWNER` set to a multisig. Steps and the gas simulation are in [DEPLOY_MAINNET.md](DEPLOY_MAINNET.md).
2. Verify on https://explorer.mezo.org and read back the four immutable addresses and `owner()`.
3. Do not route goal balances into the MUSD savings vault without a new review. Share accounting, a paused vault, who gets the yield, and a withdraw that works when the vault does not, are all open. The vault product page does not even publish the address we have seen on the explorer.
4. This file is still not an independent audit. Budget time for an outside reviewer before other people's money depends on it.

The testnet app must keep saying mainnet is not deployed until that address is real.
