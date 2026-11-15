#!/usr/bin/env bash
# Simulate a Mezo mainnet deploy. This script refuses to broadcast.
set -euo pipefail

for arg in "$@"; do
  if [[ "$arg" == "--broadcast" || "$arg" == "--private-key" || "$arg" == "--interactives" ]]; then
    echo "Refusing ${arg}. This script only simulates. See docs/DEPLOY_MAINNET.md." >&2
    exit 2
  fi
done

if [[ "${ALLOW_MAINNET_BROADCAST:-}" == "1" ]]; then
  echo "Refusing ALLOW_MAINNET_BROADCAST. This script only simulates." >&2
  exit 2
fi

if [[ -z "${POCKET_OWNER:-}" ]]; then
  echo "Set POCKET_OWNER to the multisig that should own the contract." >&2
  exit 2
fi

if [[ "${POCKET_OWNER}" == "0x0000000000000000000000000000000000000000" ]]; then
  echo "POCKET_OWNER cannot be the zero address." >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${MEZO_MAINNET_RPC:-https://mezo.drpc.org}"
export PATH="${PATH}:${HOME}/.foundry/bin"

cd "${ROOT}"
forge script script/DeployV2Mainnet.s.sol:DeployV2Mainnet \
  --rpc-url "${RPC}" \
  --sender "${POCKET_OWNER}" \
  -vv
