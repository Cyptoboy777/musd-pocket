MUSD Pocket Wave 2 submission draft (global positioning)

Product: MUSD Pocket  -  dated savings goals, family/friends chip-in, memo payments, and optional BTC-backed borrow-into-goal on Mezo.

Primary live link: https://musd-pocket-mezo.vercel.app
GitHub: https://github.com/Cyptoboy777/musd-pocket
Track: Access & Distribution
Network: Mezo testnet only (chain 31611). No mainnet funds in this submission.

Wave 1 to Wave 2 changelog
- Wave 1 Integration L2 (plain ERC-20 MUSD). Wave 2 composes Mezo BorrowerOperationsSignatures WithdrawMUSD into verified MUSDPocket v2 0xEC03F758219746b6e773f107a05cF17b66E7D460 with live ICR and liquidation price from TroveManager and PriceFeed.
- Fixed primary live URL to musd-pocket-mezo.vercel.app after Wave 1 link collision.
- Loan readiness panel states the ~2,000 MUSD debt floor (1,800 principal + 200 gas deposit). Small goals stay on plain deposit.
- Protect my loan: warns near danger ICR; one-click addColl and repay with ICR/liq preview (exercised on testnet).
- Shared-goal invite links open without a wallet; guided faucet and chip-in. Chip-in exercised end to end.
- sMUSD panel honest on testnet (no bytecode); feature flag only if vault code exists; never claims ICR benefit.
- Revenue shown in product: 2% early-unlock fee (cap 5%), 0% chip-in.
- Proof UI: my own test wallets labelled honestly. One outside tester created goal 10. No outside deposit.
- Docs: docs/ONCHAIN-ACTIVITY.md, docs/TESTER-GUIDE.md, README refresh.
- i18n: English default plus ES/PT/ZH/FR for key CTAs. Global audience copy.

Key Wave 2 txs (explorer.test.mezo.org)
- borrowToGoal: 0x15ee0df8a64757939921d4392b88909d5dfc2f0a69f1b14b407bfe780fcbba7f
- earlyWithdraw: 0x136b1533b0671c1a9b6633545a460e492c1d47e20ff87e3cd8777e1bde8245c9
- addColl: 0x2da3e12391fedcd94868e589525be5a5137c9eb4f18bbb3efd46b790edac0c22
- repayMUSD: 0x6bc4369125d44ec9863927812d96f3599accc976e17466383c4ca854e652fe5e
- helper chip-in: 0x834398190a083850ce1fa341dc5767fb8d1376a6805a7990b58d52c96eead63f

Tests: 58 Foundry passed, 0 failed, 1 skipped mainnet read, 49 Vitest passed. Counts are in facts.json.
Demo video: https://youtu.be/eWAqu1FZ-40
Pitch deck: docs/MUSD-Pocket-Wave2-Final.pdf
Mezo Passport: Unisat / Xverse / OKX via OrangeKit inside RainbowKit (testnet).
Still recruiting 3-5 real outside testers using docs/TESTER-GUIDE.md.
