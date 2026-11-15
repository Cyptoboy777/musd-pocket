#!/usr/bin/env python3
"""Fail if the frontend creation bytecode is not the current forge build."""
import json
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
artifact = root / "contracts" / "out" / "MUSDPocketV2.sol" / "MUSDPocketV2.json"
shipped = root / "frontend" / "src" / "lib" / "pocketCreationBytecode.json"

if not artifact.exists():
    sys.exit("forge build output is missing. Run forge build in contracts/.")

built = json.loads(artifact.read_text())
bytecode = built["bytecode"]["object"]
if not bytecode.startswith("0x"):
    bytecode = "0x" + bytecode

digest = subprocess.check_output(["cast", "keccak", bytecode], text=True).strip()
committed = json.loads(shipped.read_text())
if committed.get("bytecode") != bytecode or committed.get("bytecodeHash") != digest:
    sys.exit("pocketCreationBytecode.json does not match forge build. Re-export it.")
print(digest)
