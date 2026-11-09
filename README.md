<p align="center"><img src="frontend/public/logo.svg" alt="MUSD Pocket" height="56"></p>

# MUSD Pocket

We lock MUSD, Mezo's Bitcoin-backed dollar, into savings goals that have a date. You withdraw on the date, or earlier and pay the early-exit fee. You can also borrow against BTC straight into a goal, invite someone to chip in, or send MUSD with a short memo.

This is our [AKINDO Mezo Buildathon](https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10) project for the Access & Distribution track.

The app that works today is on Mezo testnet (chain 31611). Mezo mainnet does not have a Pocket deployment. One outside tester created goal 10. That record is goal creation only, with no deposit.

Addresses, the live URL, and the test counts live in [facts.json](facts.json). If a number here disagrees with that file, the file is the one we keep current.

## Where to click

- Live app: https://musd-pocket-mezo.vercel.app
- Demo video: https://youtu.be/eWAqu1FZ-40
- Pitch deck: [docs/MUSD-Pocket-Wave2-Final.pdf](docs/MUSD-Pocket-Wave2-Final.pdf)
- Repo: https://github.com/Cyptoboy777/musd-pocket
- MUSD Pocket v2, verified on Mezo testnet: [`0xEC03F758219746b6e773f107a05cF17b66E7D460`](https://explorer.test.mezo.org/address/0xEC03F758219746b6e773f107a05cF17b66E7D460)
- Wave 1 contract, history only: [`0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8`](https://explorer.test.mezo.org/address/0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8)

The verified testnet bytecode matches git `2c5bd9b`. This branch adds a per-goal fee snapshot and two-step ownership in `contracts/src/MUSDPocketV2.sol`. That source is not what is on testnet, and it is not on mainnet. We did not redeploy.

## What the app does

- Borrow into a goal, repay, add collateral, and take the early-withdraw path. Closing a trove is wired in the UI.
- Protect my loan shows the collateral ratio and liquidation price before you send.
- A shared-goal link opens before you connect a wallet, then walks through testnet, the faucet, and a chip-in.
- Mezo's minimum loan is about 1,800 MUSD plus a 200 MUSD gas deposit, so about 2,000 MUSD of debt at open. Smaller goals stay on a plain deposit.
- The MUSD savings vault is a separate mainnet product. We do not use it here, and it does not change a loan's collateral ratio.
- Early unlock fee defaults to 2%, with a 5% contract cap. Chip-in is 0%.
- English is the default. ES, PT, ZH, and FR cover the main buttons.
- `/stats` reads the testnet contract. Team wallets are labelled as ours.
- Mezo Passport connectors for Unisat, Xverse, and OKX sit next to the EVM wallets. Leather is not exported by OrangeKit. This is testnet only.

Proof and the tester invite are in [docs/ONCHAIN-ACTIVITY.md](docs/ONCHAIN-ACTIVITY.md) and [docs/TESTER-GUIDE.md](docs/TESTER-GUIDE.md). The security notes are in [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md). They are our review, not an independent audit.

## Design

Engraved light: banknote guilloche, bottle-green ink, champagne gold. Type is Gloock and Geist. Tokens are in `frontend/src/styles/tokens.css`.

## Setup

You need Foundry (we used 1.9.0), Node 22, and npm 10.

### Contracts

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
cd contracts
forge test
```

`forge test` prints 58 passed, 0 failed, 1 skipped. The skipped test reads Mezo mainnet only when `MEZO_MAINNET_RPC` is set. It does not deploy and does not broadcast.

Test counts: 58 Foundry passed, 0 failed, 1 skipped, 49 Vitest.

### Frontend

```bash
cd frontend
npm ci
npm test
npm run build
```

`npm ci` uses `frontend/.npmrc` (`legacy-peer-deps=true`) because a WalletConnect dependency asks for TypeScript 5 while this app uses TypeScript 7. `npm test` prints 49 passed. `npm run build` typechecks and writes `frontend/dist`. GitHub Actions runs both on pull requests (`.github/workflows/ci.yml`).

The Vercel project uses Root Directory `frontend`. See `frontend/vercel.json`.

## Network

Testnet, from [Mezo's getting started guide](https://mezo.org/docs/developers/getting-started/):

- Chain ID `31611`
- RPC `https://rpc.test.mezo.org`
- Explorer https://explorer.test.mezo.org
- Faucet https://faucet.test.mezo.org
- MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` from the [contracts reference](https://mezo.org/docs/users/resources/contracts-reference/)
- Borrow app https://testnet.mezo.org/feature/borrow

Mainnet (chain 31612) is documented in that same getting started guide. Pocket is not deployed there. The dry-run and the steps for a later sponsored deploy are in [docs/DEPLOY_MAINNET.md](docs/DEPLOY_MAINNET.md). We do not ask anyone to fund a wallet for it.

## Older decks

[docs/MUSD-Pocket-Wave2-Deck.pdf](docs/MUSD-Pocket-Wave2-Deck.pdf) and [docs/MUSD-Pocket-Pitch-Deck.pdf](docs/MUSD-Pocket-Pitch-Deck.pdf) are earlier versions. The current deck is the Final PDF linked above.
