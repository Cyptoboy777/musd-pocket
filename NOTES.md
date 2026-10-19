# MUSD Pocket — Research Notes

**Buildathon:** [AKINDO Mezo Buildathon](https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10)  
**Builder:** Crypto boy · AKINDO `@Cryptoboy_777`  
**Track:** Access & Distribution  
**Concept:** India-first goal savings + family remittance using Bitcoin-backed MUSD on Mezo.

## Why this concept scores

Past Mezo hackathon winners (2025) clustered around:
- **LatAm cooperative savings** (KhipuVault) — similar savings thesis, different geography/UX
- **Username payments** (MezoPay) — send/request + pots
- **Prize-linked savings** (MezoLotto), **NFC spend** (BitSpend), **creator payouts** (CreatorBank)

**MUSD Pocket** differentiates by targeting **India remittance + FD/RD mental models** (goal-lock, family chip-in, memo’d sends) with a mobile-first “fintech” UX — Access & Distribution track, strong Mezo/MUSD integration (30%), clean implementation (30%), clear business path for diaspora remittance (20%).

## Official docs

| Resource | URL |
| --- | --- |
| Developer getting started | https://mezo.org/docs/developers/getting-started/ |
| MUSD development guide | https://mezo.org/docs/developers/musd/ |
| Contracts & token addresses | https://mezo.org/docs/users/resources/contracts-reference/ |
| Connect wallet / networks | https://mezo.org/docs/users/getting-started/connect/ |
| Past hackathon winners | https://mezo.org/blog/mezo-hackathon-winners/ |
| MUSD contracts repo | https://github.com/mezo-org/musd |
| mezod testnet notes | https://github.com/mezo-org/mezod/blob/main/docs/testnet.md |
| npm artifacts | `@mezo-org/musd-contracts` |

## Mezo Testnet network

| Parameter | Value |
| --- | --- |
| Network name | Mezo Testnet |
| Chain ID | `31611` |
| RPC HTTPS | `https://rpc.test.mezo.org` |
| RPC WSS | `wss://rpc-ws.test.mezo.org` |
| Native gas token | BTC (18 decimals) |
| Block explorer | https://explorer.test.mezo.org |
| Faucet (CAPTCHA) | https://faucet.test.mezo.org |
| Chainlist | https://chainlist.org/chain/31611 |

Hardhat/Foundry tip from Mezo docs: Solidity `0.8.28`, `evmVersion: "london"`.

## MUSD / MEZO addresses

### Mezo Testnet
- **MUSD:** `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` (18 decimals, symbol `MUSD`, name `Mezo USD`) — verified via RPC `decimals()` / `symbol()` / `name()`

### Mezo Mainnet (reference)
- **MUSD:** `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186`
- **MEZO:** `0x7B7c000000000000000000000000000000000001`
- Chain ID mainnet: `31612` · Explorer: https://explorer.mezo.org

MUSD also bridges via Wormhole NTT to Ethereum / Base (same MUSD mainnet address on those chains per docs).

## Getting testnet MUSD

MUSD on testnet is **not faucet-dispensed**. Flow from Mezo x402 / borrow docs:
1. Request **testnet BTC** from https://faucet.test.mezo.org (CAPTCHA) or Mezo Discord `#testnet`
2. Borrow/mint MUSD against BTC at https://mezo.org/feature/borrow (minimum debt floor applies on borrow UI)
3. Add MUSD token `0x1189…Ac503` in the wallet

## Judging weights (historical Mezo)

- Mezo integration 30%
- Technical implementation 30%
- Business viability 20%
- UX 10%
- Presentation 10%

## Buildathon windows

- Wave 1: Oct 16–26, 2026 · $2,000 in MEZO (proportional to scores)
- Wave 2: Nov 2–15, 2026 · $5,000 in MEZO
- Hard requirement: integrate MUSD and/or MEZO; working deploy on Mezo / Ethereum / Base / BSC

## Local deployer (testnet-only)

- Address stored in `/workspace/buildathons/mezo/.env` as `DEPLOYER_ADDRESS`
- Private key in same file as `PRIVATE_KEY` — **never commit / never paste into AKINDO**
- Balance at research time: **0 BTC** → deploy blocked on faucet CAPTCHA
