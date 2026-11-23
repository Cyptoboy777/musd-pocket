#!/usr/bin/env python3
"""Fail if the frontend creation bytecode is not the current forge build (Pocket v3 and its timelock)."""
import json
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
pairs = [
    ("MUSDPocketV3.sol", "MUSDPocketV3", "pocketCreationBytecode.json"),
    ("PocketTimelock.sol", "PocketTimelock", "timelockCreationBytecode.json"),
]

for sol, name, shipped_name in pairs:
    artifact = root / "contracts" / "out" / sol / f"{name}.json"
    shipped = root / "frontend" / "src" / "lib" / shipped_name
    if not artifact.exists():
        sys.exit("forge build output is missing. Run forge build in contracts/.")
    bytecode = json.loads(artifact.read_text())["bytecode"]["object"]
    if not bytecode.startswith("0x"):
        bytecode = "0x" + bytecode
    digest = subprocess.check_output(["cast", "keccak", bytecode], text=True).strip()
    committed = json.loads(shipped.read_text())
    if committed.get("bytecode") != bytecode or committed.get("bytecodeHash") != digest:
        sys.exit(f"{shipped_name} does not match forge build. Re-export it.")
    print(name, digest)
