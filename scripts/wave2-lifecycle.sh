#!/usr/bin/env bash
# Exercise Wave 2 lifecycle on Mezo testnet only. Never prints private keys.
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."
set -a
source .env
source ../.secrets/helper.env
set +a
RPC="${MEZO_TESTNET_RPC:-https://rpc.test.mezo.org}"
P="${VITE_POCKET_ADDRESS:-0xEC03F758219746b6e773f107a05cF17b66E7D460}"
# Prefer frontend env pocket if set
if [[ -f frontend/.env ]]; then
  # shellcheck disable=SC1091
  set -a; source frontend/.env; set +a
  P="${VITE_POCKET_ADDRESS:-$P}"
fi
M="$MUSD_TESTNET"
BO="0xCdF7028ceAB81fA0C6971208e83fa7872994beE5"
TM="0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0"
HH="0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6"
ST="0x722E4D24FD6Ff8b0AC679450F3D91294607268fA"
BOS="0xD757e3646AF370b15f32EB557F0F8380Df7D639e"
PF="0x86bCF0841622a5dAC14A313a15f96A95421b9366"
LOG="/tmp/wave2-lifecycle.log"
: > "$LOG"
EX="https://explorer.test.mezo.org/tx"

send() {
  local label="$1"; shift
  local key="$1"; shift
  echo "==> $label" | tee -a "$LOG"
  local out
  if ! out=$(cast send --private-key "$key" --rpc-url "$RPC" --json "$@" 2>&1); then
    echo "FAIL $label: $out" | tee -a "$LOG"
    return 1
  fi
  local hash status
  hash=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["transactionHash"])' <<<"$out")
  status=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<<"$out")
  echo "OK|$label|$hash|$status|$EX/$hash" | tee -a "$LOG"
}

echo "Deployer=$DEPLOYER_ADDRESS Helper=$HELPER_ADDRESS Pocket=$P" | tee -a "$LOG"

# --- 1) Create short-lock goal for early withdraw + a shared goal for invite chip-in ---
NOW=$(cast block latest --rpc-url "$RPC" --field timestamp)
U7=$((NOW + 7*86400 + 300))
U30=$((NOW + 30*86400 + 300))
NEXT=$(cast call "$P" "nextGoalId()(uint256)" --rpc-url "$RPC")
G_EARLY=$NEXT
send "createGoal early-buffer" "$PRIVATE_KEY" "$P" "createGoal(string,uint256,uint64,bool)" "Wave2 early buffer" 100000000000000000000 "$U7" false || true
NEXT=$(cast call "$P" "nextGoalId()(uint256)" --rpc-url "$RPC")
G_SHARE=$NEXT
send "createGoal shared-invite" "$PRIVATE_KEY" "$P" "createGoal(string,uint256,uint64,bool)" "Wave2 shared invite" 500000000000000000000 "$U30" true || true

# If create failed because next moved, re-read latest owned goals heuristically
G_EARLY=$(cast call "$P" "nextGoalId()(uint256)" --rpc-url "$RPC")
G_EARLY=$((G_EARLY - 2))
G_SHARE=$((G_EARLY + 1))
echo "Using G_EARLY=$G_EARLY G_SHARE=$G_SHARE" | tee -a "$LOG"

# Approve pocket for deposits / early path
send "approve MUSD for Pocket" "$PRIVATE_KEY" "$M" "approve(address,uint256)" "$P" 500000000000000000000

# Deposit into early goal then early-withdraw
send "deposit 25 MUSD into early goal" "$PRIVATE_KEY" "$P" "deposit(uint256,uint256)" "$G_EARLY" 25000000000000000000
send "earlyWithdraw early goal (2% fee)" "$PRIVATE_KEY" "$P" "earlyWithdraw(uint256)" "$G_EARLY"

# Shared invite: add helper, fund helper gas+MUSD, chip-in
send "setFamilyMember helper on shared" "$PRIVATE_KEY" "$P" "setFamilyMember(uint256,address,bool)" "$G_SHARE" "$HELPER_ADDRESS" true
# top up helper gas if low
HBAL=$(cast balance "$HELPER_ADDRESS" --rpc-url "$RPC")
if [[ "$HBAL" -lt 100000000000000 ]]; then
  send "gas top-up helper" "$PRIVATE_KEY" "$HELPER_ADDRESS" --value 0.0003ether
fi
# memo/send MUSD to helper for chip-in
send "approve remittance" "$PRIVATE_KEY" "$M" "approve(address,uint256)" "$P" 30000000000000000000
send "memo 20 MUSD to helper for chip-in" "$PRIVATE_KEY" "$P" "sendRemittance(address,uint256,string)" "$HELPER_ADDRESS" 20000000000000000000 "Wave2 invite chip-in fund"
send "helper approve Pocket" "$HELPER_KEY" "$M" "approve(address,uint256)" "$P" 20000000000000000000
send "helper chip-in 15 MUSD shared" "$HELPER_KEY" "$P" "deposit(uint256,uint256)" "$G_SHARE" 15000000000000000000

# --- Protect path: addColl + repay on deployer trove ---
# hints: use zero addresses (protocol accepts and finds) for simplicity on small adjust
send "addColl 0.001 BTC" "$PRIVATE_KEY" "$BO" "addColl(address,address)" "$DEPLOYER_ADDRESS" "$DEPLOYER_ADDRESS" --value 0.001ether || \
  send "addColl 0.001 BTC (zero hints)" "$PRIVATE_KEY" "$BO" "addColl(address,address)" 0x0000000000000000000000000000000000000000 0x0000000000000000000000000000000000000000 --value 0.001ether

# approve BO for repay
send "approve MUSD for BorrowerOps repay" "$PRIVATE_KEY" "$M" "approve(address,uint256)" "$BO" 100000000000000000000
send "repayMUSD 50" "$PRIVATE_KEY" "$BO" "repayMUSD(uint256,address,address)" 50000000000000000000 0x0000000000000000000000000000000000000000 0x0000000000000000000000000000000000000000

# --- borrow-into-goal via BOS signature path is complex in bash; use pocket if we can craft sig with cast ---
# Create goal for borrow target
NEXT=$(cast call "$P" "nextGoalId()(uint256)" --rpc-url "$RPC")
G_BORROW=$NEXT
send "createGoal borrow-target" "$PRIVATE_KEY" "$P" "createGoal(string,uint256,uint64,bool)" "Wave2 borrow into goal" 200000000000000000000 "$U30" false

# Use a small node script with viem/ethers if available; else cast wallet sign typed data
python3 - <<'PY' >>"$LOG" 2>&1 || true
print("NOTE: borrow-into-goal signature step deferred to node helper")
PY

# --- Secondary wallet: open tiny trove, then close (full close lifecycle) ---
# Generate ephemeral key in memory file with 600 perms, fund, open, close
TMPKEY=$(mktemp)
chmod 600 "$TMPKEY"
cast wallet new --json > /tmp/w2wallet.json
python3 - <<'PY'
import json
from pathlib import Path
w=json.load(open('/tmp/w2wallet.json'))
Path('/tmp/w2pk').write_text(w['private_key'])
Path('/tmp/w2addr').write_text(w['address'])
print('EPHEMERAL_ADDR', w['address'])
PY
WADDR=$(cat /tmp/w2addr)
WKEY=$(cat /tmp/w2pk)
rm -f /tmp/w2wallet.json
echo "Ephemeral wallet $WADDR" | tee -a "$LOG"
send "fund ephemeral gas" "$PRIVATE_KEY" "$WADDR" --value 0.045ether

# openTrove: 0.04 BTC coll, 1800 MUSD debt
# openTrove(uint256 _debtAmount, address _upperHint, address _lowerHint) payable
send "ephemeral openTrove 1800 MUSD" "$WKEY" "$BO" "openTrove(uint256,address,address)" 1800000000000000000000 0x0000000000000000000000000000000000000000 0x0000000000000000000000000000000000000000 --value 0.04ether || echo "openTrove failed (may need better hints/ICR)" | tee -a "$LOG"

# If open succeeded, repay enough from minted MUSD isn't needed for close — closeTrove burns debt from wallet MUSD
# After open, wallet holds ~1800 MUSD; close needs full debt (~2001). Gas compensation refunded.
# Actually closeTrove requires borrower to have full debt amount in MUSD. Net debt 1800 + interest/fee + gas 200 in trove; wallet has 1800. So need extra ~201 MUSD.
# Send extra MUSD from deployer via remittance/pocket or ERC20 transfer
send "approve transfer to ephemeral" "$PRIVATE_KEY" "$M" "transfer(address,uint256)" "$WADDR" 250000000000000000000 || true
send "ephemeral approve BO" "$WKEY" "$M" "approve(address,uint256)" "$BO" 2500000000000000000000 || true
send "ephemeral closeTrove" "$WKEY" "$BO" "closeTrove()" || echo "closeTrove failed" | tee -a "$LOG"

# scrub ephemeral key
rm -f /tmp/w2pk /tmp/w2addr "$TMPKEY"
echo DONE | tee -a "$LOG"
