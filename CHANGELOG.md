# Changelog

## Wave 3 (24 Nov 2026), branch `wave3-judge`

Answers the Wave 2 judge feedback point by point. The full mapping, with commits and tests, is in [docs/JUDGE-FEEDBACK.md](docs/JUDGE-FEEDBACK.md).

### Contracts

- **MUSDPocketV3** on Mezo testnet: `0xF86c8ef87F617041BBbcF61EeBE34cB811E7616c`, verified on Blockscout and Sourcify (`exact_match`).
- Earn mode: a goal can park its MUSD in Mezo's MUSD Savings Vault (sMUSD). Withdraw pays principal plus yield. The early-exit fee rule is unchanged.
- Emergency repay and full close of the goal owner's own Mezo loan, paid from the goal, through `BorrowerOperationsSignatures`. Live 1,800 MUSD minimum net debt pre-check.
- Borrow into a goal is refused in Recovery Mode.
- Owned by **PocketTimelock** `0xb6790A383679A3364E656dAd1E8fCf4195f37990` with a 2-day delay.
- New scripts: testnet deploy, mainnet preflight and deploy (no key in the repo), read-only mainnet gas estimate, Blockscout and Sourcify verify.
- Tests: 99 Foundry passed, 0 failed, 1 skipped, plus 8 fork tests against live Mezo testnet. Slither output in `docs/wave3/slither-v3.txt`.

### App

- Fixed the pending-rewards double count in the loan (ICR) view and the borrow preview.
- Goal cards show an earning switch with yield earned, and loan health with a "Protect my loan" dialog for repay or close, with plain risk copy.
- Recovery Mode banner; the borrow form is replaced by a short explanation while it lasts.
- Live safety checks panel: system mode, total collateral ratio, 150% floor, 1,800 MUSD minimum, MUSD parked in the vault.
- Testers section: outside wallets, deposits and chip-ins read from the Mezo explorer, builder wallets left out.
- Team section, three-step first run, and v2 goal owners get a note with a link to withdraw on the explorer.
- The preview-only deploy page now deploys the timelock and then v3 from the owner's MetaMask.
- Fixed missing inner padding on several Wave 2 side panels.

### Not done, and why

- Mainnet deploy: ready and preflighted, about $0.41 of BTC, but it is the owner's to send from their own wallet.
- sMUSD gauge staking: no gauge is registered for sMUSD (`VeBTCVoter.gauges(sMUSD)` is zero on both networks).
- Outside deposits and chip-ins: the counter is live, and today it reads 0. That needs real people.
- Emergency repay and close are proven on a fork of live testnet, not yet as broadcast transactions.
- The Wave 2 deck and video are not updated for Wave 3.

## Wave 2

Borrow into a goal through `BorrowerOperationsSignatures.withdrawMUSDWithSignature`, permit deposits, per-goal fee snapshot, loan panel, invite links, `/stats`. Contract `0xEC03F758219746b6e773f107a05cF17b66E7D460`.

## Wave 1

Dated MUSD goals, shared goals, memo payments. Contract `0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8`.
