# Mezo mainnet deploy (not executed)

MUSD Pocket is live on Mezo testnet only:

`0xEC03F758219746b6e773f107a05cF17b66E7D460`

That address has no code on Mezo mainnet. The app refuses savings transactions unless the wallet is on Mezo testnet, and it does not send mainnet transactions to the testnet contract.

Do not broadcast a mainnet deploy until you have decided to fund it.

Mezo's developer docs list mainnet chain id **31612** and testnet chain id **31611**: https://mezo.org/docs/developers/getting-started/

A read of `eth_chainId` on `https://mezo.drpc.org` returned 31612. The script refuses to continue unless `block.chainid` is 31612, then checks that the dependency contracts have code, that MUSD's symbol is `MUSD`, that BorrowerOperations points at the signatures contract below, and that PriceFeed returns a price. Those checks happen before `startBroadcast`.

## Contracts the script uses

| Piece | Address |
|---|---|
| MUSD | `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` |
| BorrowerOperations | `0x44b1bac67dDA612a41a58AAf779143B181dEe031` |
| BorrowerOperationsSignatures | `0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a` |
| TroveManager | `0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193` |
| PriceFeed | `0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88` |

## 1. Simulate only

From `contracts/`, with no key and no `--broadcast`:

```bash
export DEPLOYER=0xYourAddress
forge script script/DeployV2Mainnet.s.sol:DeployV2Mainnet \
  --rpc-url https://mezo.drpc.org \
  --sender "$DEPLOYER"
```

This does not deploy. A testnet RPC stops at the chain id check.

## 2. Broadcast yourself, later

Do not put a private key on the command line or in `PRIVATE_KEY`. Foundry can use an encrypted keystore or a hardware wallet. Let it prompt for the password. Do not pass `--password`.

Encrypted keystore:

```bash
cast wallet import pocket-deployer --interactive
```

```bash
export DEPLOYER=0xYourAddress
forge script script/DeployV2Mainnet.s.sol:DeployV2Mainnet \
  --rpc-url https://mezo.drpc.org \
  --account pocket-deployer \
  --sender "$DEPLOYER" \
  --broadcast
```

Ledger or Trezor, with the device unlocked and the Ethereum app open:

```bash
forge script script/DeployV2Mainnet.s.sol:DeployV2Mainnet \
  --rpc-url https://mezo.drpc.org \
  --ledger \
  --sender "$DEPLOYER" \
  --broadcast
```

Replace `--ledger` with `--trezor` for a Trezor.

Then confirm on https://explorer.mezo.org that the new address has code on chain 31612. Do not point the app at the testnet address for mainnet users. Wiring a verified mainnet address into the app is a separate change.
