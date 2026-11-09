# MUSD Pocket contracts

Foundry project. Solidity 0.8.28, optimizer 200 runs, EVM `london`, matching [Mezo's getting started guide](https://mezo.org/docs/developers/getting-started/).

The live app is https://musd-pocket-mezo.vercel.app. It talks to the verified Mezo testnet deployment of v2, `0xEC03F758219746b6e773f107a05cF17b66E7D460`, which was built from git `2c5bd9b`.

## Layout

- `src/MUSDPocket.sol` is the Wave 1 contract. It stays as deployed.
- `src/MUSDPocketV2.sol` is the current source. It adds borrow-into-goal, permit deposits, a per-goal early-exit fee, and two-step ownership. Those last two are not in the verified testnet bytecode.
- `script/DeployV2.s.sol` is the testnet deployer. It requires `POCKET_OWNER` and `PRIVATE_KEY`. The testnet contract is already deployed. Do not broadcast this unless you mean to deploy a new one.
- `script/DeployV2Mainnet.s.sol` deploys on chain 31612. `script/deploy-mainnet.sh` only simulates. See [docs/DEPLOY_MAINNET.md](../docs/DEPLOY_MAINNET.md).

## Test

```bash
forge test
```

Expect 58 passed and 1 skipped. The skipped test is `MainnetPreflightTest`, and it runs only when `MEZO_MAINNET_RPC` is set. It does not broadcast.

## Mainnet

Set `POCKET_OWNER` to the multisig, then:

```bash
./script/deploy-mainnet.sh
```

That command refuses `--broadcast`. The owner is never defaulted to the deployer key.
