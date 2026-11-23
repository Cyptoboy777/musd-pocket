# Deploy MUSD Pocket v3 on Mezo mainnet

Pocket is not on Mezo mainnet yet. The app at https://musd-pocket-mezo.vercel.app works on Mezo testnet, where v3 is `0xF86c8ef87F617041BBbcF61EeBE34cB811E7616c`.

The owner deploys mainnet from their own wallet. Nobody else holds the key, and no script in this repo has a key or a default owner. `facts.json` keeps `mainnet.pocket: null` until a real deployment exists and is verified.

## What gets deployed

Two contracts, in this order:

1. `PocketTimelock(admin = your wallet, delay = 2 days)`
2. `MUSDPocketV3(Config)` with `owner = the timelock from step 1`

| Config field | Mezo mainnet address | Source |
|---|---|---|
| musd | `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` | [Contracts reference](https://mezo.org/docs/users/resources/contracts-reference/) |
| borrowerOperations | `0x44b1bac67dDA612a41a58AAf779143B181dEe031` | [mezo-org/musd v1.1.0](https://github.com/mezo-org/musd/releases/tag/v1.1.0) |
| borrowerOperationsSignatures | `0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a` | same release, and `BorrowerOperations.borrowerOperationsSignaturesAddress()` |
| troveManager | `0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193` | same release |
| priceFeed | `0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88` | same release |
| savingsVault (sMUSD) | `0xb4D498029af77680cD1eF828b967f010d06C51CC` | [Mezo vault notices](https://mezo.org/docs/users/mezo-earn/vaults/vault-notices/) and `PCV.feeRecipient()` on mainnet |
| owner | the PocketTimelock address | created in step 1 |

`DeployV3Mainnet.preflight()` checks all of this on chain before anything is sent: code exists at every address, BorrowerOperations points at that Signatures contract, `sMUSD.musdToken()` is MUSD, `PCV.feeRecipient()` is sMUSD, and `minNetDebt()` is set. We ran it read-only against mainnet on 24 Nov 2026 and it passed.

## What it costs

Measured on 24 Nov 2026 at 01:15 IST with `contracts/script/estimate-v3-mainnet-gas.sh` (read-only):

| | Gas |
|---|---|
| PocketTimelock | 609,493 |
| MUSDPocketV3 | 3,952,774 |
| Total | 4,562,267 |

At the 0.0014625 gwei gas price the RPC returned, that is 0.000006672315 BTC. Mezo's own PriceFeed read BTC at $60,979.16, so about **$0.41**. With $0.79 of BTC in the wallet there is roughly 1.9x headroom. If the gas price doubles before you deploy, $0.79 is no longer enough, so run the estimate again right before you send.

## Option A: the deploy page (MetaMask)

1. Open the Vercel preview of the `wave3-judge` branch and add `/deploy-tool` to the URL. The page only exists on preview builds; the public app does not ship it.
2. Connect MetaMask and press "Switch to Mezo". It adds chain 31612 if needed.
3. Check the timelock admin field shows your own address, and compare the two bytecode hashes on the page with `scripts/check_deploy_artifact.py`.
4. Press "Deploy with MetaMask (2 transactions)". MetaMask asks twice. The page reads back the timelock's admin and delay before it sends the Pocket, and stops if anything differs.
5. After the Pocket is mined the page reads back every Config field and the owner, and says whether they match.

## Option B: forge from a terminal

```bash
cd contracts
forge build
# read-only checks
forge script script/DeployV3Mainnet.s.sol:DeployV3Mainnet --sig "preflight()" --rpc-url https://mezo.drpc.org
# deploy, signing in your own wallet (hardware wallet or interactive prompt; never a key in a file)
POCKET_ADMIN=0xYourWallet forge script script/DeployV3Mainnet.s.sol:DeployV3Mainnet \
  --rpc-url https://mezo.drpc.org --broadcast --ledger      # or --interactives 1
```

## Verify after deploy

```bash
cd contracts
NETWORK=mainnet POCKET=0xPocket TIMELOCK=0xTimelock ADMIN=0xYourWallet ./script/verify-v3.sh
```

That submits the source to Mezo's Blockscout (https://explorer.mezo.org) and to Sourcify. It sends no transaction. On testnet the same script gave Sourcify `exact_match` for both contracts. If Blockscout says "already verified" because an identical contract exists, use the explorer's "Verify & publish" page with the flattened source (`forge flatten src/MUSDPocketV3.sol`), compiler 0.8.28, optimizer 200, EVM london.

Then put the addresses in `facts.json` under `mainnet` and set `status` to `deployed`.

## Older material

The Wave 2 mainnet dry-run for v2 is in git history (`git show master:docs/DEPLOY_MAINNET.md`). It is superseded by this page.
