# MUSD Pocket

India-first **goal savings + family remittance** app for [Mezo](https://mezo.org)’s Bitcoin-backed **MUSD**.  
Built for the [AKINDO Mezo Buildathon](https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10) · Access & Distribution track · `@Cryptoboy_777`.

## Links

- **Live demo:** https://cyptoboy777.github.io/musd-pocket/
- **MUSDPocket contract (Mezo testnet):** [`0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8`](https://explorer.test.mezo.org/address/0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8)
- **Deploy tx:** [`0x98181dcd…b61df6`](https://explorer.test.mezo.org/tx/0x98181dcdda80939a99ce5dbd33be70cc4081356f50561d9be46545b0eab61df6)
- **Repo:** https://github.com/Cyptoboy777/musd-pocket

## Quick start

### Contracts (Foundry)

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cd contracts
forge test -vv
```

Deploy to Mezo testnet (needs BTC gas on deployer):

```bash
set -a && source ../.env && set +a
forge script script/Deploy.s.sol:Deploy --rpc-url "$MEZO_TESTNET_RPC" --broadcast -vvvv
```

The frontend defaults to the deployed address `0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8`; override with `VITE_POCKET_ADDRESS` in `frontend/.env`.

### Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

The hosted build is deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `master` that touches `frontend/` (Vite `base` = `/musd-pocket/`).

## Network

- Chain ID `31611` · RPC `https://rpc.test.mezo.org`
- MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`
- MUSDPocket `0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8`
- Explorer https://explorer.test.mezo.org
- Faucet https://faucet.test.mezo.org (CAPTCHA)

See [NOTES.md](./NOTES.md) and [SUBMISSION.md](./SUBMISSION.md).
