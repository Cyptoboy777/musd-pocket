# MUSDPocket contracts

Foundry project targeting Mezo Testnet (chain id `31611`, EVM london, solc 0.8.28).

## Contracts
- `MUSDPocket.sol` — goal vault + family allowlist + remittance helper for MUSD
- `mocks/MockMUSD.sol` — 18-decimal ERC20 for local tests

## Test
```bash
forge test -vv
```

## Deploy (Mezo testnet)
1. Fund `DEPLOYER_ADDRESS` from https://faucet.test.mezo.org (CAPTCHA)
2. `set -a && source ../.env && set +a`
3. `forge script script/Deploy.s.sol:Deploy --rpc-url $MEZO_TESTNET_RPC --broadcast -vvvv`
4. Copy logged `MUSDPocket` address into `frontend/.env` as `VITE_POCKET_ADDRESS`
