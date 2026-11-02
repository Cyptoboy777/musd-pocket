# On-chain activity: MUSD Pocket (Mezo testnet) — Wave 2 v2

Network: Mezo testnet only (chain 31611). Explorer: https://explorer.test.mezo.org  
No mainnet funds. Times below are Asia/Calcutta.

## Contracts

| Contract | Address | Notes |
|---|---|---|
| MUSDPocket v2 (current) | [0xEC03F758219746b6e773f107a05cF17b66E7D460](https://explorer.test.mezo.org/address/0xEC03F758219746b6e773f107a05cF17b66E7D460) | Verified. Borrow-into-goal, permit deposits, early fee. Deploy tx [0xa58ddba9…64f6](https://explorer.test.mezo.org/tx/0xa58ddba9e9c1fb87ee211016f729491806bf74e06ce23fa38a97fe0d092d64f6) |
| MUSDPocket v1 (Wave 1) | [0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8](https://explorer.test.mezo.org/address/0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8) | Kept for history (19 Wave 1 txs) |
| MUSD (canonical) | [0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503](https://explorer.test.mezo.org/address/0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503) | |
| BorrowerOperations | [0xCdF7028ceAB81fA0C6971208e83fa7872994beE5](https://explorer.test.mezo.org/address/0xCdF7028ceAB81fA0C6971208e83fa7872994beE5) | addColl / repayMUSD / closeTrove / openTrove |
| BorrowerOperationsSignatures | [0xD757e3646AF370b15f32EB557F0F8380Df7D639e](https://explorer.test.mezo.org/address/0xD757e3646AF370b15f32EB557F0F8380Df7D639e) | WithdrawMUSD EIP-712 for borrow-into-goal |
| TroveManager | [0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0](https://explorer.test.mezo.org/address/0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0) | Live ICR inputs |
| PriceFeed | [0x86bCF0841622a5dAC14A313a15f96A95421b9366](https://explorer.test.mezo.org/address/0x86bCF0841622a5dAC14A313a15f96A95421b9366) | BTC price |
| HintHelpers / SortedTroves | [0x4e4c…BCF6](https://explorer.test.mezo.org/address/0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6) / [0x722E…68fA](https://explorer.test.mezo.org/address/0x722E4D24FD6Ff8b0AC679450F3D91294607268fA) | Hints for adjust paths |
| sMUSD Savings Vault (documented mainnet) | 0xb4D498029af77680cD1eF828b967f010d06C51CC | eth_getCode empty on 31611 — honest empty panel in app |

## Wallets

### My own test wallets (builder)
| Role | Address |
|---|---|
| Deployer / saver | [0xA8F5Ce266d62430f4B83C94fC5ADfb737948d1EA](https://explorer.test.mezo.org/address/0xA8F5Ce266d62430f4B83C94fC5ADfb737948d1EA) |
| Wave 1 second key / invite chip-in | [0xEEB0C4736e3ce84c85aEfe1BB63144422191509a](https://explorer.test.mezo.org/address/0xEEB0C4736e3ce84c85aEfe1BB63144422191509a) |
| Wave 2 generated (self) | [0xF02F…bb29](https://explorer.test.mezo.org/address/0xF02F7c394713DCECfB94D993BB584b8cA5D4bb29), [0xa482…2985](https://explorer.test.mezo.org/address/0xa4824D70514a6a2a78CECe3d7D25549F0b472985), [0x77eb…c580](https://explorer.test.mezo.org/address/0x77eb4E81c9B9be068b2aE3fbA7545fFb28C2c580) |

### Community testers
Empty on purpose until real third-party addresses with explorer txs are available. No fake users.

## Wave 2 lifecycle txs (exercised 3 Nov 2026, Asia/Calcutta)

| Step | Tx |
|---|---|
| createGoal early-buffer #5 | [0x3c3b1ea7…32a6](https://explorer.test.mezo.org/tx/0x3c3b1ea702b4d1cd557d2ad3484e8899b3187f547c8dffbde68e7ba5605d32a6) |
| createGoal shared-invite #6 | [0xb5237d0f…42d3](https://explorer.test.mezo.org/tx/0xb5237d0ff190f673184fd9b8adf8af66a30a4e965993f6269e11becf3a7242d3) |
| createGoal borrow-target #7 | [0x5eeb18a5…50d2](https://explorer.test.mezo.org/tx/0x5eeb18a567e95eb220660132e52fa52282c993295b5ce9faece8e116a01150d2) |
| deposit 25 MUSD into #5 | [0x017c424a…c7b5](https://explorer.test.mezo.org/tx/0x017c424a0610bd4ae5bfea2b679cb9f2cb9cc3e7bc43678f7a2a4b3c382bc7b5) |
| earlyWithdraw #5 (2% fee path) | [0x136b1533…45c9](https://explorer.test.mezo.org/tx/0x136b1533b0671c1a9b6633545a460e492c1d47e20ff87e3cd8777e1bde8245c9) |
| setFamilyMember for invite chip-in | [0xe115dff3…5eb8](https://explorer.test.mezo.org/tx/0xe115dff3375ff1b34c69a8de6de590fa22607535fec281dfc12d7d5e13685eb8) |
| helper chip-in 15 MUSD into #6 | [0x83439819…d63f](https://explorer.test.mezo.org/tx/0x834398190a083850ce1fa341dc5767fb8d1376a6805a7990b58d52c96eead63f) |
| addColl 0.001 BTC (Protect path) | [0x2da3e123…0c22](https://explorer.test.mezo.org/tx/0x2da3e12391fedcd94868e589525be5a5137c9eb4f18bbb3efd46b790edac0c22) |
| repayMUSD 10 (Protect path; kept above 1,800 min net debt) | [0x6bc43691…fe5e](https://explorer.test.mezo.org/tx/0x6bc4369125d44ec9863927812d96f3599accc976e17466383c4ca854e652fe5e) |
| borrowToGoal 5 MUSD into #7 | [0x15ee0df8…ba7f](https://explorer.test.mezo.org/tx/0x15ee0df8a64757939921d4392b88909d5dfc2f0a69f1b14b407bfe780fcbba7f) |

closeTrove: UI wired in Protect my loan. Not re-exercised in this run because deployer test BTC was too low to open a fresh ephemeral trove after addColl, and closing the existing deployer trove needs ~2,000 MUSD free in-wallet. Wave 1 already opened a trove via BorrowerOperations ([0x55b2363a…09a681](https://explorer.test.mezo.org/tx/0x55b2363a03a45078873efdd76a976cef0f0f6831b7beaf29bbf05549ee09a681)).

## Wave 1 → Wave 2 changelog

| Wave 1 critique | Wave 2 fix |
|---|---|
| Integration L2: plain ERC-20 only | Verified v2 compose into BorrowerOperationsSignatures WithdrawMUSD (borrow-into-goal) + live TroveManager/PriceFeed ICR & liq price + Protect addColl/repay |
| Borrow-into-goal unverified / unused in app | Contract verified; wired in UI; exercised on-chain (tx above) |
| Wrong live link collision | Primary URL https://musd-pocket-mezo.vercel.app only |
| Vault not considered | Honest sMUSD panel; feature flag activates only if vault bytecode exists on connected chain; does not raise ICR |
| Only two wallets / need real users | Self wallets labelled honestly; Community testers section empty until real third parties; invite + tester guide ready |
| Debt floor clarity (dsh_agent) | Loan readiness panel: 1,800 + 200 ≈ 2,000 MUSD |
| Testnet vs mainnet labelling | Footer + README + tester guide state testnet-only |

## Revenue model (transparent)

Early unlock fee 2% (contract max 5%), fee pool on-chain. Chip-in and on-time unlock 0%. Shown in-app Revenue panel and this doc.
