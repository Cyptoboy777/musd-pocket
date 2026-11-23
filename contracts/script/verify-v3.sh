#!/usr/bin/env bash
# Verify MUSDPocketV3 + PocketTimelock on Mezo Blockscout, then try Sourcify.
# Usage: NETWORK=testnet|mainnet POCKET=0x.. TIMELOCK=0x.. ADMIN=0x.. ./script/verify-v3.sh
# Read-only for your wallet: it uploads source code to the explorer, sends no transaction.
set -euo pipefail
export PATH="${PATH}:${HOME}/.foundry/bin"
cd "$(cd "$(dirname "$0")/.." && pwd)"
NETWORK="${NETWORK:-testnet}"
if [[ "$NETWORK" == "mainnet" ]]; then
  CHAIN=31612; API=https://api.explorer.mezo.org/api/
  CFG="(0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186,0x44b1bac67dDA612a41a58AAf779143B181dEe031,0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a,0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193,0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88,0xb4D498029af77680cD1eF828b967f010d06C51CC,${TIMELOCK})"
else
  CHAIN=31611; API=https://api.explorer.test.mezo.org/api/
  CFG="(0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503,0xCdF7028ceAB81fA0C6971208e83fa7872994beE5,0xD757e3646AF370b15f32EB557F0F8380Df7D639e,0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0,0x86bCF0841622a5dAC14A313a15f96A95421b9366,0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16,${TIMELOCK})"
fi
DELAY="${DELAY:-172800}"
PARGS=$(cast abi-encode "f((address,address,address,address,address,address,address))" "$CFG")
TARGS=$(cast abi-encode "f(address,uint256)" "$ADMIN" "$DELAY")
for v in blockscout sourcify; do
  URL=""; [[ $v == blockscout ]] && URL="--verifier-url $API"
  forge verify-contract "$POCKET" src/MUSDPocketV3.sol:MUSDPocketV3 --chain-id $CHAIN --verifier $v $URL --constructor-args "$PARGS" --watch || echo "$v: MUSDPocketV3 not verified"
  forge verify-contract "$TIMELOCK" src/PocketTimelock.sol:PocketTimelock --chain-id $CHAIN --verifier $v $URL --constructor-args "$TARGS" --watch || echo "$v: PocketTimelock not verified"
done
