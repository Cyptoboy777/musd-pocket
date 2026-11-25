# Submission draft (fill in only what is true on the day)

## What changed since Wave 2 feedback

| Judge feedback | Status |
|----------------|--------|
| Pocket relays `withdrawMUSDWithSignature` and mints debt into a goal, verified on-chain | Done (L4), see testnet contract `0xEC03F758219746b6e773f107a05cF17b66E7D460` |
| Disable borrow in Recovery Mode | PR #12: form disabled and re-checked at send time |
| Pre-check the 1,800 MUSD minimum on repay | PR #12: blocked up front, floor 2,000 total (1,800 net + 200 gas), read from the contract |
| Fix pending-rewards double count in the ICR view | PR #12: trove numbers reconcile against `getCurrentICR` |
| Productive use of locked MUSD, and self-repay in an emergency | Designed in `docs/V3-DESIGN.md`. Mark **shipped** only after fork tests pass |
| Outside wallets deposit and chip in | Fill from the tracker in `docs/TRACTION-KIT.md` |
| Ship on mainnet | Not deployed. Update only when true |

Before submitting, change "PR #12" to "shipped" only after it is merged and
`cd frontend && npm ci && npm test && npm run build` passes.

## One-page summary (replace the bracketed numbers with real ones)

**MUSD Pocket** is a savings and loan-safety app for Mezo's MUSD. People set dated goals,
friends and family chip in, and BTC holders borrow MUSD from their own loan straight into a goal
without selling BTC. A protection panel shows loan health and warns before liquidation.

- Real usage: [N] outside wallets, [N] deposits, [N] chip-ins (explorer links in the appendix).
- Mezo integration: signature-relayed `withdrawMUSDWithSignature`, MUSD permit, trove ICR checks, Recovery Mode and minimum-debt guards.
- Safety: strict accounting (owner cannot touch goal balances), reentrancy lock, two-step ownership, tests.
- Business case: [fees on early exit (2%, cap 5%), planned vault yield share, who pays and why]. Fill with what you have actually decided.
- Next: v3 (vault routing, emergency self-repay), then mainnet with a small cap.

## Demo video outline (2-3 minutes)

1. 0:00 Problem in one sentence: saving in MUSD is easy to forget, and loans get liquidated quietly.
2. 0:15 Create a shared goal, send the invite link.
3. 0:40 A second wallet chips in (show the explorer tx).
4. 1:10 Borrow into a goal, then show Recovery Mode and the repay-minimum messages blocking a bad action.
5. 1:50 Protect-my-loan panel: ICR before and after.
6. 2:20 What outside testers did (real numbers) and what ships next.
