# MUSD Pocket frontend

The app is the Vite project in this folder. Setup, tests, and the contract addresses are in the [root README](../README.md) and [facts.json](../facts.json).

```bash
npm ci
npm test
npm run build
```

`npm test` is 49 Vitest tests passed. The live app is https://musd-pocket-mezo.vercel.app. It writes to Mezo testnet contract `0xEC03F758219746b6e773f107a05cF17b66E7D460`. Mainnet Pocket is not deployed.
