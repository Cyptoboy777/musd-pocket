# MUSD Pocket contracts

Foundry project. Solidity 0.8.28, optimizer 200 runs, EVM `london`, matching [Mezo's getting started guide](https://mezo.org/docs/developers/getting-started/).

The live app is https://musd-pocket-mezo.vercel.app. It talks to MUSD Pocket v3 on Mezo testnet, `0xF86c8ef87F617041BBbcF61EeBE34cB811E7616c`, owned by PocketTimelock `0xb6790A383679A3364E656dAd1E8fCf4195f37990`. Both are verified on Blockscout and Sourcify.

## Layout

- `src/MUSDPocketV3.sol` is the current contract: dated goals, shared goals, memo payments, borrow into a goal, earn in Mezo's MUSD Savings Vault, emergency repay and close of the owner's own loan, and a Recovery Mode guard on borrow.
- `src/PocketTimelock.sol` owns v3. Admin actions wait 2 days (min 1, max 30) and expire after a 14-day grace period.
- `src/MUSDPocketV2.sol` (Wave 2, `0xEC03F758219746b6e773f107a05cF17b66E7D460`) and `src/MUSDPocket.sol` (Wave 1) stay for history.
- `src/mocks/` holds the test doubles. `MezoMocksV3.sol` copies the real sMUSD index math.
- `script/DeployV3.s.sol` deploys to testnet only (timelock first, then the Pocket).
- `script/DeployV3Mainnet.s.sol` has a read-only `preflight()` and a `run()` that you sign with your own wallet. See [docs/DEPLOY_MAINNET.md](../docs/DEPLOY_MAINNET.md).
- `script/estimate-v3-mainnet-gas.sh` estimates the mainnet deploy cost. Read-only.
- `script/verify-v3.sh` submits source to Blockscout and Sourcify. Sends no transaction.

## Test

```bash
forge test
RUN_FORK=1 forge test --match-path 'test/*fork*'
```

Expect 99 passed, 0 failed, 1 skipped, then 8 fork tests passed against live Mezo testnet. The skipped test is `MainnetPreflightTest`; it runs only when `MEZO_MAINNET_RPC` is set and never broadcasts.
