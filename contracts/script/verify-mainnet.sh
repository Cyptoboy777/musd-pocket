#!/usr/bin/env bash
# Print the Blockscout verify command. Does not submit it.
set -euo pipefail

if [[ "${1:-}" == "--send" || "${VERIFY_SEND:-}" == "1" ]]; then
  echo "Refusing to submit a verification. Run the printed forge command yourself after deploy." >&2
  exit 2
fi

MUSD="0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186"
BOS="0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a"
TM="0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193"
PF="0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88"
ADDR="${POCKET_ADDRESS:-<deployed-address>}"
OWNER="${POCKET_OWNER:-<multisig>}"

cat <<EOF
# Not submitted. Replace the placeholders, then run this from contracts/ after a real deploy.
# Explorer API: https://explorer.mezo.org/api
# Chain 31612: https://mezo.org/docs/developers/getting-started/

cd contracts
forge verify-contract \\
  --rpc-url "\${MEZO_MAINNET_RPC:-https://mezo.drpc.org}" \\
  --verifier blockscout \\
  --verifier-url https://explorer.mezo.org/api \\
  ${ADDR} \\
  src/MUSDPocketV2.sol:MUSDPocketV2 \\
  --constructor-args \$(cast abi-encode "constructor(address,address,address,address,address)" ${MUSD} ${BOS} ${TM} ${PF} ${OWNER})

# Then read musd(), borrowerOpsSig(), troveManager(), priceFeed(), and owner().
# They must match the constructor args. owner() must be the multisig, not the deployer key.
# Only after that, set facts.json mainnet.pocket and mainnet.status.
EOF
