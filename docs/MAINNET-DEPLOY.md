# Mezo mainnet preflight

MUSD Pocket is live on Mezo testnet only:

`0xEC03F758219746b6e773f107a05cF17b66E7D460`

That address has no code on Mezo mainnet (chain 31612). The app still refuses savings transactions off Mezo testnet. No mainnet Pocket address is configured.

Deployment is **pending sponsorship**. This repository does not broadcast, sign, or spend BTC. The testnet deployer `0xA8F5Ce266d62430f4B83C94fC5ADfb737948d1EA` is a labeled test wallet and is not the mainnet deployer. No other public deployer address is recorded here.

## Sponsorship check

Mezo's public docs were checked for a route that would deploy this contract without someone paying gas.

- Mainnet gas is BTC. The developer guide and glossary say fees are paid in BTC. Chain id 31612 was read from those docs and confirmed with `eth_chainId` on `https://mezo.drpc.org`, a public RPC listed in that guide.
- The testnet faucet supplies test BTC only. It does not pay mainnet deployment.
- [Get Gas](https://mezo.org/docs/users/getting-started/get-gas/) is a gasless swap: a relay submits the swap, and the wallet pays in MUSD or MEZO for 0.0001 BTC. That spends the holder's tokens. It is not a free contract deployment.
- Founder, foundation, and hackathon grant pages describe applications and prizes. They are not an automatic gas relayer, and this work does not apply or contact anyone.

No verified sponsorship for this deployment was found. The contract stays undeployed on mainnet until a sponsor pays the gas. Do not fund a wallet for it.

## What was checked, read-only

`forge script script/DeployV2Mainnet.s.sol:DeployV2Mainnet --rpc-url https://mezo.drpc.org` ran with no broadcast. It logged chain 31612, MUSD symbol `MUSD`, and BorrowerOperations pointing at `0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a`. TroveManager and PriceFeed have code. A separate `eth_call` of `PriceFeed.fetchPrice()` returned a price. Foundry's simulator cannot run Mezo's oracle precompile, so the script checks PriceFeed's code and the price is taken from that direct call.

Constructor, if a sponsor later deploys the same artifact:

| Argument | Value |
|---|---|
| musd | `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` |
| borrowerOperationsSignatures | `0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a` |
| troveManager | `0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193` |
| priceFeed | `0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88` |
| initialOwner | not chosen |

There is no proxy and no proxy admin. The owner would be `initialOwner`. At deployment `earlyFeeBps` is 200 (2%), and the contract caps it at 500 (5%). The owner can change that fee inside the cap, claim the fee pool, recover tokens that are not locked in a goal, and transfer ownership. The owner cannot take goal principal. This is not an independent audit.

## Artifact and gas estimate

Toolchain: Foundry `1.9.0` (`6056c5845d`), solc `0.8.28`, optimizer on, 200 runs, EVM version `london`.

Creation bytecode, before constructor arguments, keccak `0xe5acec4b85e125ae2e81ab3b75853d5620debf023f6e8fc5ae1d3fe836bba177`.

With the placeholder owner above, the full init code keccak is `0x8ad5d7af35859c00e556e13e59917ded260f238bc3902b5a1a69630d8667505a`.

A read-only `eth_estimateGas` of that bytecode plus the constructor arguments above, with a placeholder owner `0x000000000000000000000000000000000000dEaD` (not a deployer), returned **2,308,865** gas. `eth_gasPrice` on the same RPC was **1,462,500** wei. That is about **0.000003377 BTC**. `fetchPrice()` was about **75,792 USD per BTC**, so the gas is about **0.26 USD**. Those three reads are the sources of the estimate. It is not an invoice and not a request to pay.

The init-code hash changes if `initialOwner` changes. No deployment address is claimed, because no sponsor address or nonce is known.

## What remains

A sponsor with mainnet BTC can deploy and verify this artifact later. Until that transaction exists and its code and immutables match `frontend/src/lib/mainnetPocket.ts`, the frontend keeps the mainnet address empty and savings writes on Mezo testnet only.
