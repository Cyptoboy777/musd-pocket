# MUSD Pocket

India-first **goal savings + family remittance** app for [Mezo](https://mezo.org)’s Bitcoin-backed **MUSD**.  
Built for the [AKINDO Mezo Buildathon](https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10) · Access & Distribution track · `@Cryptoboy_777`.

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

Then set `VITE_POCKET_ADDRESS` in `frontend/.env` to the deployed address.

### Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## Network

- Chain ID `31611` · RPC `https://rpc.test.mezo.org`
- MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`
- Faucet https://faucet.test.mezo.org (CAPTCHA)

See [NOTES.md](./NOTES.md) and [SUBMISSION.md](./SUBMISSION.md).
