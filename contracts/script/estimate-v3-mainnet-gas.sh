#!/usr/bin/env bash
# Read-only: estimate what deploying PocketTimelock + MUSDPocketV3 on Mezo mainnet costs in BTC and USD.
# Sends nothing. Needs only a public RPC. Usage:
#   POCKET_OWNER=0xYourAddress ./script/estimate-v3-mainnet-gas.sh
set -euo pipefail
export PATH="${PATH}:${HOME}/.foundry/bin"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${MEZO_MAINNET_RPC:-https://mainnet.mezo.public.validationcloud.io}"
OWNER="${POCKET_OWNER:-0x000000000000000000000000000000000000dEaD}"
cd "$ROOT"
forge build --silent
BYTECODE=$(jq -r '.bytecode.object' out/MUSDPocketV3.sol/MUSDPocketV3.json)
ARGS=$(cast abi-encode "f((address,address,address,address,address,address,address))" \
  "(0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186,0x44b1bac67dDA612a41a58AAf779143B181dEe031,0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a,0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193,0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88,0xb4D498029af77680cD1eF828b967f010d06C51CC,${OWNER})")
POCKET_GAS=$(cast estimate --rpc-url "$RPC" --from "$OWNER" --create "${BYTECODE}${ARGS#0x}")
TL_BYTECODE=$(jq -r '.bytecode.object' out/PocketTimelock.sol/PocketTimelock.json)
TL_ARGS=$(cast abi-encode "f(address,uint256)" "$OWNER" 172800)
TL_GAS=$(cast estimate --rpc-url "$RPC" --from "$OWNER" --create "${TL_BYTECODE}${TL_ARGS#0x}")
echo "timelock gas      $TL_GAS"
echo "pocket gas        $POCKET_GAS"
GAS=$((TL_GAS + POCKET_GAS))
PRICE_WEI=$(cast gas-price --rpc-url "$RPC")
BTC_USD_WEI=$(cast call 0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88 "fetchPrice()(uint256)" --rpc-url "$RPC" | awk '{print $1}')
python3 - "$GAS" "$PRICE_WEI" "$BTC_USD_WEI" <<'PY'
import sys
gas, gp, px = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
btc = gas * gp / 1e18
usd = btc * px / 1e18
print(f"total deploy gas  {gas:,}")
print(f"gas price         {gp:,} wei ({gp/1e9:.7f} gwei)")
print(f"BTC/USD (Mezo)    {px/1e18:,.2f}")
print(f"cost              {btc:.12f} BTC  ~ ${usd:.6f}")
print(f"cost at 5x price  ~ ${usd*5:.6f}")
PY
