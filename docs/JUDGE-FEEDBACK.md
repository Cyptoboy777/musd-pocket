# Wave 2 feedback → Wave 3 fix

Live app: https://musd-pocket-mezo.vercel.app · v3 on Mezo testnet: [`0xF86c8ef87F617041BBbcF61EeBE34cB811E7616c`](https://explorer.test.mezo.org/address/0xF86c8ef87F617041BBbcF61EeBE34cB811E7616c) (verified on Blockscout, Sourcify `exact_match`)

The Wave 2 comment, in full:

> Your integration now reaches L4: Pocket relays BorrowerOperationsSignatures.withdrawMUSDWithSignature and mints trove debt straight into a goal, verified on-chain, which fixes the core of your Wave 1 feedback. To go further, give locked MUSD a productive use (for example routing into the MUSD Savings Vault or a Stability Pool position) and let a goal repay its own trove in an emergency, so the lock reduces loan risk instead of adding to it. Traction is the weak spot: get outside wallets to deposit and chip in, not just create goals, and ship on mainnet. Also disable borrow in Recovery Mode, pre-check the 1,800 MUSD minimum debt on repay, and fix the pending-rewards double count in the ICR view.

Each point below names the commit and the tests that cover it. Commits are on the `wave3-judge` branch.

| # | Feedback | What we changed | Commit | Tests |
|---|---|---|---|---|
| 1 | Give locked MUSD a productive use (MUSD Savings Vault) | `setEarn(goalId, true)` moves a goal's MUSD into Mezo's MUSD Savings Vault (sMUSD). Later deposits and borrows into that goal park automatically. Withdraw, early withdraw and turning earning off pay principal plus the goal's share of the yield. The early-exit fee rule is unchanged: the same percentage of the whole goal balance, as in v2. | `8cc38b4` | `test_earn_*` (8), `test_settleYield_anyoneCanCreditGoal`, `testFuzz_yieldNeverOverpays`, fork `test_fork_earnInRealSavingsVault` |
| 2 | Let a goal repay its own trove in an emergency | `emergencyRepay` relays `BorrowerOperationsSignatures.repayMUSDWithSignature` and `emergencyClose` relays `closeTroveWithSignature`. Only the goal owner can call them, only for their own trove, and the goal pays. On close, Mezo sends the freed BTC straight to the owner. In the app: "Protect my loan" on each goal card. | `8cc38b4`, `3cdf487` | `test_repay_*` (11), `test_close_*` (3), fork `test_fork_emergencyRepayRealTrove`, `test_fork_emergencyCloseRealTrove` |
| 3 | Pre-check the 1,800 MUSD minimum debt on repay | The contract reads `BorrowerOperations.minNetDebt()` live and reverts `BelowMinNetDebt(maxRepayable)` before calling Mezo. The app runs the same check first, offers the largest allowed amount, and points to "close the whole loan" instead. | `8cc38b4`, `b6b7e20` | `test_repay_preChecksMinNetDebt`, `test_repay_minNetDebtReadLive`, fork `test_fork_repayMinNetDebtPrecheck`, Vitest "keeps 1,800 MUSD net debt" |
| 4 | Disable borrow in Recovery Mode | `borrowToGoal` reverts `RecoveryModeActive` when `TroveManager.checkRecoveryMode(price)` is true. The app shows a Recovery Mode banner and replaces the borrow form with a plain note. | `8cc38b4`, `3cdf487` | `test_borrowToGoal_blockedInRecoveryMode`, `test_close_blockedInRecoveryMode` |
| 5 | Fix the pending-rewards double count in the ICR view | `getEntireDebtAndColl` already includes pending collateral and debt in its totals. Wave 2 added the pending fields again. `troveFromEntire` now uses the totals once, in the loan panel and in the borrow preview. | `b6b7e20` | Vitest "ignores the informational pending fields (already folded in by Mezo)" |
| 6 | Traction: outside wallets that deposit and chip in | New Testers section reads every Pocket event (v3 and v2) from the Mezo explorer and counts only wallets that are not ours. Each shared goal has an invite link. Today it shows 2 outside wallets, 3 goals created, **0 outside deposits and 0 chip-ins**. We are not inflating that. | `3cdf487` | Vitest `testers.test.ts` (3) |
| 7 | Ship on mainnet | Mainnet deploy is ready and preflighted read-only, and the owner can run it from their own MetaMask on the preview's `/deploy-tool` page. It is not deployed yet. Estimated cost: about $0.41 of BTC. See [DEPLOY_MAINNET.md](DEPLOY_MAINNET.md). | `8cc38b4`, `3cdf487` | `DeployV3Mainnet.preflight()`, Vitest `deployMainnet.test.ts` (8) |

## Also new in Wave 3

- **Timelocked ownership.** v3 is owned by `PocketTimelock` ([`0xb6790A38…7990`](https://explorer.test.mezo.org/address/0xb6790A383679A3364E656dAd1E8fCf4195f37990)), 2-day delay. Fee changes and fee claims are queued in public. The owner can never touch goal balances or yield. Tests: `PocketTimelock.t.sol` (7).
- **Live safety checks panel.** System mode, total collateral ratio, the 150% borrow floor, the 1,800 MUSD minimum and how much is parked in the Savings Vault, all read from Mezo.
- **Three-step first run.** Connect, get test money, start a goal and switch on earning.
- **Team section** with role and links.

## The fee choice for emergency repay and close

Repaying a loan from a goal is a way to take money out of a locked goal. If it were always free, anyone could skip the lock with a tiny loan. So:

- **Free** when the goal is already unlocked, when the loan is below 200% collateral (at risk), or when Mezo is in Recovery Mode. That is the emergency the judges described.
- **Otherwise** the goal's own early-exit fee (stored when the goal was created, 2% today) applies to the amount, exactly like an early withdraw.

Mezo's own fees on repay and close are not changed; Pocket only relays the signed call. Close also needs the 200 MUSD gas deposit, which Mezo returns as part of closing, so the goal needs debt minus 200 MUSD.

## Why not the sMUSD gauge or the Stability Pool

- **sMUSD gauge.** `VeBTCVoter.gauges(sMUSD)` returns zero on both mainnet and testnet, and Mezo's docs do not publish a gauge address. Staking would also swap MUSD yield for MEZO emissions, which is harder to share fairly between goals. We left it out until there is a canonical gauge.
- **Stability Pool.** Deposits there can be used to absorb liquidations, so a goal's MUSD could turn into BTC. That breaks the promise of a dated MUSD goal.

## On-chain evidence (Mezo testnet)

- v3 deploy: [0x0fe3ef15…145b](https://explorer.test.mezo.org/tx/0x0fe3ef152b860d1a8dbc7fa4a11d1a02c959301e34d4d7457e84a379eb1b145b); timelock deploy: [0xb3f9fab5…c5c2](https://explorer.test.mezo.org/tx/0xb3f9fab51645dda964fa0c4eabd50a3c44f1b7fa1aa75dfa4c3a5bc5e850c5c2)
- Goal 1 created, 20 MUSD deposited, earning switched on, so 20 MUSD now sits in the real sMUSD: [create](https://explorer.test.mezo.org/tx/0x6015c794c55e30130cc768b3d68091f5340591fbd577f8c28f1112b09b26bbe2), [deposit](https://explorer.test.mezo.org/tx/0x6fc072536d1f4aa776765b852a11c9ca40b9067d94d3ac930f68fc231bd88701), [setEarn](https://explorer.test.mezo.org/tx/0xc3f52cbfae7ba178e1a96b7dcf4bd148229a3fb77be0fd348962d81644a3ed26). These are our own builder wallet, not a tester.
- Emergency repay and close are proven on a fork of live Mezo testnet (real BorrowerOperationsSignatures, real trove, real sMUSD) by the four fork tests. They have not been broadcast yet: our builder trove was redeemed and the wallet does not hold enough test BTC to open a new 2,000 MUSD loan.

## Slither

`slither .` on v3 reports 30 results ([full output](wave3/slither-v3.txt)). None are high. The ones left:

- reentrancy-benign / no-eth / events: calls go to MUSD and Mezo's own vault and Signatures contracts, and every external entry point is `nonReentrant`. Accounting is written before the calls where Slither asked.
- timestamp: unlock dates and signature deadlines are meant to use block time.
- strict equality: the "received exactly the borrowed amount" check is deliberate.
- low-level calls: the MUSD transfer helper checks both the call result and the returned bool.
- locked-ether: false positive. `receive()` exists only because Mezo's ActivePool makes a zero-value call, and it reverts on any non-zero value, so the contract cannot hold BTC. On close, Mezo sends the freed BTC straight to the goal owner.

## Test counts

99 Foundry passed, 0 failed, 1 skipped; 8 fork tests passed against live Mezo testnet; 64 Vitest. The same numbers are in [facts.json](../facts.json).
