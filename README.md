<p align="center"><img src="frontend/public/logo.svg" alt="MUSD Pocket" height="56"></p>

# MUSD Pocket

> Money that keeps its promises. Lock MUSD, Mezo's Bitcoin-backed dollar, into savings goals with a date. Withdraw on time, or early for a 2% fee. Borrow against your BTC straight into a goal. Invite friends worldwide to chip in. Send MUSD to anyone with an on-chain memo.

Global **goal savings + memo payments** app for [Mezo](https://mezo.org)’s Bitcoin-backed **MUSD**.
Built for the [AKINDO Mezo Buildathon](https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10) · Access & Distribution track · `@Cryptoboy_777`.

**The working app is Mezo testnet (chain 31611).** Mezo mainnet is not a Pocket deployment. One outside community tester created goal #10; that record is goal creation only.

## Wave 2

- **Live app (primary):** https://musd-pocket-mezo.vercel.app
- Also: https://musd-pocket-wheat.vercel.app · GitHub Pages: https://cyptoboy777.github.io/musd-pocket/
- **Do not use** `musd-pocket.vercel.app` (another team's app).
- **MUSDPocket v2 (verified):** [`0xEC03F758219746b6e773f107a05cF17b66E7D460`](https://explorer.test.mezo.org/address/0xEC03F758219746b6e773f107a05cF17b66E7D460)
- **Full loan lifecycle in-app:** borrow-into-goal, repay, add collateral (Protect), early-withdraw fee path; close trove control wired.
- **Protect my loan:** warns as ICR approaches danger; one-click addColl / repay via BorrowerOperations with hints; previews ICR and liquidation price before send.
- **Shared-goal invite link:** friends can open without a wallet first, then guided onboarding (add network, faucet, connect, chip in).
- **Loan readiness:** Mezo minimum ~1,800 MUSD principal + 200 MUSD gas deposit ≈ 2,000 MUSD total debt at open. Small savers keep the plain deposit path.
- **Savings Vault (sMUSD):** a separate Mezo mainnet product. Pocket does not use it on testnet, and it does not raise trove ICR. Pocket itself is not deployed on Mezo mainnet; the app refuses savings transactions unless the wallet is on Mezo testnet.
- **Revenue:** early-unlock fee 2% (cap 5%), chip-in 0% — shown in-product and in docs.
- **i18n:** English default; optional ES / PT / ZH / FR for key CTAs (tabs, empty states, fee preview, stats). Global audience copy.
- **/stats:** Public on-chain stats (goal count, TVL, deposits, fee pool, recent events with explorer links). Team test wallets labelled.
- **Shareable goal card:** Invite `?invite=N` shows progress; Web Share + copy + X/Telegram/WhatsApp intents.
- **UX:** Early-withdraw fee preview + confirm; Protect close-trove confirm + insufficient-MUSD pre-check; hero sample clearly labelled example-only.
- **PWA:** `manifest.webmanifest` + light app-shell service worker (no stale chain data).
- **Mezo Passport (BTC wallets):** Unisat, Xverse, and OKX via `@mezo-org/orangekit` connector factories inside RainbowKit (Vite alias maps `orangekit-smart-account/src` → `dist`). Leather is not exported by OrangeKit/Passport. EVM connect unchanged. Testnet only — BTC wallet signing needs the extension installed; no mainnet/user funds.
- **Proof:** builder test wallets labelled as such. One community tester, with the goal #10 createGoal explorer link. See [docs/ONCHAIN-ACTIVITY.md](docs/ONCHAIN-ACTIVITY.md) and [docs/TESTER-GUIDE.md](docs/TESTER-GUIDE.md).

## Design

**Art direction: "Engraved light."** Banknote-style guilloche, bottle-green ink, champagne-gold light.
Type: Gloock + Geist. Tokens in `frontend/src/styles/tokens.css`.

## Links

- **Live demo:** https://musd-pocket-mezo.vercel.app
- **Demo video:** https://youtu.be/eWAqu1FZ-40
- **MUSDPocket v2 (Mezo testnet, verified):** [`0xEC03…D460`](https://explorer.test.mezo.org/address/0xEC03F758219746b6e773f107a05cF17b66E7D460)
- **v1 (Wave 1):** [`0x2d5f…A1C8`](https://explorer.test.mezo.org/address/0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8)
- **Repo:** https://github.com/Cyptoboy777/musd-pocket
- **On-chain activity:** [docs/ONCHAIN-ACTIVITY.md](docs/ONCHAIN-ACTIVITY.md) · **Tester guide:** [docs/TESTER-GUIDE.md](docs/TESTER-GUIDE.md) · **Security:** [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md)

## Quick start

### Contracts (Foundry)

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cd contracts
forge test
```

### Frontend

Tests: **47 Foundry** plus 1 skipped mainnet read unless `MEZO_MAINNET_RPC` is set (`forge test`), and **47 Vitest** (`npm test`).

```bash
cd frontend
npm install
npm test
npm run build
```

Hosted on Vercel with Root Directory `frontend` (see `frontend/vercel.json`). Pages workflow still builds with `VITE_BASE=/musd-pocket/`.

## Network (testnet)

- Chain ID `31611` · RPC `https://rpc.test.mezo.org`
- MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` (18 decimals)
- MUSDPocket v2 `0xEC03F758219746b6e773f107a05cF17b66E7D460`
- Explorer https://explorer.test.mezo.org
- Faucet https://faucet.test.mezo.org
- Borrow https://testnet.mezo.org/feature/borrow (min 1,800 MUSD + 200 gas deposit)
- Mainnet bytecode is prepared and checked. Deployment is pending a verified gas sponsorship. The app does not ask anyone to fund a wallet. See [docs/MAINNET-DEPLOY.md](docs/MAINNET-DEPLOY.md).

## Pitch

- Current pitch deck (PDF): [docs/MUSD-Pocket-Wave2-Final.pdf](docs/MUSD-Pocket-Wave2-Final.pdf)
- Current slides: [docs/MUSD-Pocket-Wave2-Final.pptx](docs/MUSD-Pocket-Wave2-Final.pptx)
- Earlier decks, kept as history: [docs/MUSD-Pocket-Wave2-Deck.pdf](docs/MUSD-Pocket-Wave2-Deck.pdf), [docs/MUSD-Pocket-Pitch-Deck.pdf](docs/MUSD-Pocket-Pitch-Deck.pdf)
- Pitch video (Wave 2 demo): https://youtu.be/eWAqu1FZ-40
