# Mezo mainnet deploy (not executed)

MUSD Pocket is live on Mezo testnet only:

`0xEC03F758219746b6e773f107a05cF17b66E7D460`

That address has no code on Mezo mainnet (chain 31612). The app refuses savings transactions unless the wallet is on Mezo testnet, and it does not send mainnet transactions to the testnet contract.

Do not broadcast a mainnet deploy until you have decided to fund it. Keep the key off git and off the command history you share.

## Contracts the script uses

Checked against Mezo's public docs and a public mainnet read:

| Piece | Address |
|---|---|
| MUSD | `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` |
| BorrowerOperationsSignatures | `0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a` |
| TroveManager | `0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193` |
| PriceFeed | `0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88` |

## 1. Simulate only

From `contracts/`, with no private key and no `--broadcast`:

```bash
export DEPLOYER=0xYourAddress
forge script script/DeployV2Mainnet.s.sol:DeployV2Mainnet \
  --rpc-url https://mezo.drpc.org \
  --sender "$DEPLOYER"
```

This prints a simulated address. It does not deploy.

## 2. Broadcast yourself, later

Only after you intend to spend mainnet BTC on gas:

```bash
forge script script/DeployV2Mainnet.s.sol:DeployV2Mainnet \
  --rpc-url https://mezo.drpc.org \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

Then confirm on https://explorer.mezo.org that the new address has code on chain 31612. Do not point the app at the testnet address for mainnet users. Wiring a verified mainnet address into the app is a separate change.
