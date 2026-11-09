# Deploy MUSD Pocket on Mezo mainnet

Pocket is not deployed on Mezo mainnet. The app at https://musd-pocket-mezo.vercel.app sends savings transactions only on Mezo testnet, to `0xEC03F758219746b6e773f107a05cF17b66E7D460`.

`facts.json` has `mainnet.pocket: null` and `mainnet.status: "not-deployed"`. Do not set those fields until a transaction exists and the checks below pass. A simulation address is not a deployment.

This runbook does not broadcast, sign, or spend BTC. Gas on mainnet is BTC. Use a sponsored deployer. Do not send user funds to pay for it.

## What we already simulated

On 9 Nov 2026 we ran, from `contracts/`, with no `--broadcast` and no private key:

```bash
POCKET_OWNER=0x000000000000000000000000000000000000dEaD \
forge script script/DeployV2Mainnet.s.sol:DeployV2Mainnet \
  --rpc-url https://mezo.drpc.org \
  --sender 0x000000000000000000000000000000000000dEaD \
  -vv
```

`0x000…dEaD` is a stand-in so the script has an owner argument. It is not our multisig and not a deployer we control. Forge printed a predicted create address for that sender at nonce 0. Ignore it. The dry-run JSON has `"hash": null` and an empty receipt list.

Forge reported:

- Chain `31612`
- Create gas `3133328` (`0x2fcf90`)
- Estimated native cost `0.000008146655933328` BTC at the fee the RPC returned (max fee about `0.002600001` gwei)

That is a simulation, not an invoice. Run the same command again before a real deploy. BTC's dollar price is not part of this estimate.

The same command is wrapped by `contracts/script/deploy-mainnet.sh`, which exits if you pass `--broadcast` or a private key flag.

`forge test` also logs a local creation cost around 2.45 million gas inside the test VM (`test_creationGas_isBounded`). The RPC simulation above is the number to plan with, because it includes transaction overhead on chain 31612.

## Official addresses

| Argument | Address | Source |
|---|---|---|
| Chain | Mezo mainnet, id `31612`, gas BTC, 18 decimals, explorer https://explorer.mezo.org | [Getting started](https://mezo.org/docs/developers/getting-started/) |
| RPC used for the dry-run | `https://mezo.drpc.org` | Same page (dRPC). Boar, Imperator, and Validation Cloud are also listed there. |
| musd | `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` | [Contracts reference](https://mezo.org/docs/users/resources/contracts-reference/) and the [musd v1.1.0 release](https://github.com/mezo-org/musd/releases/tag/v1.1.0) |
| borrowerOperationsSignatures | `0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a` | [musd v1.1.0 release](https://github.com/mezo-org/musd/releases/tag/v1.1.0) (proxy) |
| troveManager | `0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193` | same release (proxy) |
| priceFeed | `0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88` | same release (proxy) |
| initial owner | the multisig you pass as `POCKET_OWNER` | not in the docs, because it is ours |

The getting started page points at [github.com/mezo-org/musd](https://github.com/mezo-org/musd). We use the proxy addresses from that repo's v1.1.0 release, not implementation addresses. The script checks that BorrowerOperations (`0x44b1bac67dDA612a41a58AAf779143B181dEe031`, same release) still points at the signatures proxy, and that MUSD's symbol is `MUSD`.

There is no proxy and no proxy admin on Pocket. `owner` is the constructor argument. At deploy, `earlyFeeBps` is 200 (2%) and the cap is 500 (5%). Goals store the fee in force when they are created. A later `setEarlyFeeBps` does not change open goals. The owner can claim the fee pool, recover tokens that are not locked in a goal, and start a two-step ownership move. The owner cannot take goal principal. This is not an independent audit. See [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

## Deploy from MetaMask

The public app at https://musd-pocket-mezo.vercel.app does not include a deploy page. Vercel preview builds (`VERCEL_ENV=preview`) serve `/deploy-tool`. That page connects MetaMask, asks for Mezo mainnet (chain 31612, RPC `https://mezo.drpc.org`, explorer https://explorer.mezo.org, from the [getting started guide](https://mezo.org/docs/developers/getting-started/)), and sends the creation transaction from the wallet. The key stays in MetaMask. `deploy-mainnet.sh` still refuses `--broadcast`.

Constructor arguments shown on the page, same as `contracts/script/DeployV2Mainnet.s.sol`:

| Argument | Address | Source |
|---|---|---|
| musd | `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` | [Contracts reference](https://mezo.org/docs/users/resources/contracts-reference/) and [musd v1.1.0](https://github.com/mezo-org/musd/releases/tag/v1.1.0) |
| borrowerOperationsSignatures | `0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a` | [musd v1.1.0](https://github.com/mezo-org/musd/releases/tag/v1.1.0) proxy |
| troveManager | `0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193` | same release, proxy |
| priceFeed | `0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88` | same release, proxy |
| initialOwner | the address you type, defaulting to the connected wallet | your multisig |

BorrowerOperations `0x44b1bac67dDA612a41a58AAf779143B181dEe031` is the proxy the script checks. It is not a constructor argument.

On the page, confirm the gas estimate and the creation-bytecode hash, then confirm in MetaMask. After the receipt, the page reads `musd`, `borrowerOpsSig`, `troveManager`, `priceFeed`, and `owner` and says whether they match. Leave `facts.json` `mainnet.pocket` null until the explorer verification below passes.

## Verify the source on the explorer

From `contracts/`, after you have the deployed address and the owner you used. This does not broadcast a Pocket transaction. It submits the source to the explorer API when you run it.

```bash
cd contracts
forge verify-contract \
  --rpc-url https://mezo.drpc.org \
  --verifier blockscout \
  --verifier-url https://explorer.mezo.org/api \
  <deployed-address> \
  src/MUSDPocketV2.sol:MUSDPocketV2 \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address,address)" \
    0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186 \
    0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a \
    0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193 \
    0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88 \
    <owner>)
```

`https://mezo.drpc.org` and chain 31612 are from the [getting started guide](https://mezo.org/docs/developers/getting-started/). The four protocol addresses are from the [contracts reference](https://mezo.org/docs/users/resources/contracts-reference/) (MUSD) and the [musd v1.1.0 release](https://github.com/mezo-org/musd/releases/tag/v1.1.0) (the three proxies). `./script/verify-mainnet.sh` prints this command and does not send it.

## After the transaction exists

Check all of these before telling the app that mainnet is live:

- `eth_getCode` on the new address is not `0x`.
- `musd()`, `borrowerOpsSig()`, `troveManager()`, and `priceFeed()` match the table above.
- `owner()` is the multisig. `pendingOwner()` is zero.
- `earlyFeeBps()` is 200 unless the multisig already changed it.
- The explorer shows the verified source for this commit, not the older testnet bytecode.
- Set `facts.json` `mainnet.pocket` to that address and `mainnet.status` to `deployed`.
- `walletChains()` will then include chain 31612. Savings writes in `frontend/src/lib/mezo.ts` still target the testnet pocket and the testnet Mezo contracts. Point those at mainnet in the same change, and require `mainnetPocketReady` (code plus the four immutables) before a mainnet write. Do not claim mainnet is live until that change is deployed to https://musd-pocket-mezo.vercel.app.

Until that address exists, the footer says mainnet Pocket is not deployed.
