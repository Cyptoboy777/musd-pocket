# MUSD Pocket, AKINDO paste draft (Wave 3)

Paste this by hand. Do not auto-submit. Builder: Crypto boy (@Cryptoboy_777).

Current facts are in [facts.json](facts.json). The live app is https://musd-pocket-mezo.vercel.app.

## Project name

MUSD Pocket

## Track

Access & Distribution

## Tagline

Dated MUSD savings goals on Mezo that earn in the Savings Vault and can rescue your own loan.

## What it does

1. Create a savings goal in MUSD with an unlock date. Fill it from your wallet, borrow into it against your BTC, or let friends chip in.
2. Switch on earning and the goal's MUSD sits in Mezo's MUSD Savings Vault (sMUSD). You get principal plus yield back.
3. If BTC drops, "Protect my loan" repays part of your Mezo loan from the goal, or closes it. It is free while the loan is at risk, and it never goes below Mezo's 1,800 MUSD minimum.
4. Borrowing into a goal stops automatically in Recovery Mode.
5. Admin changes wait 2 days in a public timelock. Nobody can touch goal balances.

It runs on Mezo testnet (chain 31611). v3 is `0xF86c8ef87F617041BBbcF61EeBE34cB811E7616c`, verified on Blockscout and Sourcify. Mezo mainnet does not have it yet; the deploy is ready for us to send from our own wallet (about $0.41 of BTC).

## What changed since Wave 2

Every point from the Wave 2 review is mapped to a commit and a test in [docs/JUDGE-FEEDBACK.md](docs/JUDGE-FEEDBACK.md).

## Honest traction

Two outside wallets have created goals. None has deposited or chipped in yet. The app's Testers section counts this live from the explorer and leaves our own wallets out.

## Technologies

- Solidity 0.8.28 and Foundry (99 tests passed, 1 skipped, plus 8 fork tests on live testnet), Slither
- Vite, React, TypeScript, wagmi, viem, RainbowKit, OrangeKit (64 Vitest)
- Mezo MUSD, BorrowerOperationsSignatures, TroveManager, PriceFeed, MUSD Savings Vault

## Links

- Live app: https://musd-pocket-mezo.vercel.app
- Contract: [`0xF86c8ef87F617041BBbcF61EeBE34cB811E7616c`](https://explorer.test.mezo.org/address/0xF86c8ef87F617041BBbcF61EeBE34cB811E7616c)
- Repo: https://github.com/Cyptoboy777/musd-pocket
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Video and deck: Wave 2 versions, https://youtu.be/eWAqu1FZ-40 and [docs/MUSD-Pocket-Wave2-Final.pdf](docs/MUSD-Pocket-Wave2-Final.pdf). Not updated for Wave 3 yet.

Older contracts: v2 `0xEC03F758219746b6e773f107a05cF17b66E7D460`, v1 `0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8`.
