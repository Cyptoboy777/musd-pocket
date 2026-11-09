# MUSD Pocket, AKINDO paste draft

Paste this by hand. Do not auto-submit. Builder: Crypto boy (@Cryptoboy_777).

Current facts are in [facts.json](facts.json). The live app is https://musd-pocket-mezo.vercel.app.

## Project name

MUSD Pocket

## Track

Access & Distribution

## Tagline

Dated MUSD savings goals on Mezo, with an optional borrow straight into the goal.

## What it does

MUSD Pocket is a web app where we:

1. Create a savings goal in MUSD with an unlock date.
2. Deposit MUSD. The contract holds it until the date.
3. Invite someone to chip into a shared goal. Only the goal owner can withdraw.
4. Send MUSD with a short memo.
5. Leave early and pay the early-exit fee, or wait and pay nothing.

The working deployment is MUSD on Mezo testnet (chain 31611). Gas is test BTC. The verified contract is `0xEC03F758219746b6e773f107a05cF17b66E7D460`. Wave 2 also reads the trove: borrow into the goal, show the collateral ratio and liquidation price, add collateral, and repay.

Mezo mainnet does not have this contract. We do not claim it is live there.

## What we learned the hard way

- The testnet faucet is CAPTCHA-gated, so a script cannot fund a deployer by itself.
- Testnet MUSD comes from a swap or a borrow, not the faucet. The app walks through that. A new loan is about 1,800 MUSD plus a 200 MUSD gas deposit.
- WalletConnect needs a real project id. Without one, the app offers browser wallets only.
- The early-exit fee is capped at 5%. The source we would deploy next stores the fee on each goal when the goal is created. The verified testnet contract still uses the current global fee.

## Technologies

- Solidity 0.8.28 and Foundry, london EVM, as in the Mezo docs
- Vite, React, TypeScript
- wagmi, viem, RainbowKit, and OrangeKit for Unisat, Xverse, and OKX
- Mezo testnet RPC `https://rpc.test.mezo.org`, explorer https://explorer.test.mezo.org

## How we built it

1. Read the Mezo docs and the MUSD addresses, and picked goal savings for the Access track.
2. Shipped v1, then v2 with borrow-into-goal against BorrowerOperationsSignatures.
3. Kept Foundry and Vitest green. Current counts are in facts.json (58 Foundry passed, 0 failed, 1 skipped, 56 Vitest).
4. Hosted the frontend at https://musd-pocket-mezo.vercel.app.

## Links

- Live app: https://musd-pocket-mezo.vercel.app
- Contract: [`0xEC03F758219746b6e773f107a05cF17b66E7D460`](https://explorer.test.mezo.org/address/0xEC03F758219746b6e773f107a05cF17b66E7D460)
- Repo: https://github.com/Cyptoboy777/musd-pocket
- Deck: [docs/MUSD-Pocket-Wave2-Final.pdf](docs/MUSD-Pocket-Wave2-Final.pdf)
- Video: https://youtu.be/eWAqu1FZ-40

Wave 1 used `0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8`. That address is history. One outside tester created goal 10 on v2 and has not deposited.
