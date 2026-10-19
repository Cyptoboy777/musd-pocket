# MUSD Pocket — AKINDO Submission Draft

> Paste into AKINDO manually. Do **not** auto-submit. Builder: Crypto boy (@Cryptoboy_777).

## Project name
**MUSD Pocket**

## Track
Access & Distribution

## Tagline
Bitcoin-backed savings goals and family remittance for everyday India — powered by Mezo MUSD.

## What it does
MUSD Pocket is a mobile-first web app where users:
1. **Create FD-style savings goals** in MUSD (Emergency, Wedding, Education…) with a lock date.
2. **Deposit Bitcoin-backed MUSD** into a smart-contract vault that soft-locks until unlock.
3. **Invite family members** to chip into shared goals.
4. **Send remittances** with an on-chain memo (“Ma rent”, “School fees”) so transfers are human-readable on explorers.
5. **Early-withdraw** if needed, paying a small fee into a protocol fee pool (discourages breaking the goal).

All balances settle in **MUSD on Mezo Testnet**. Gas is paid in **BTC**.

## The problem it solves
India already thinks in recurring deposits, gold schemes, and UPI family sends — but crypto UX is still explorer-native. Diaspora workers and crypto-curious savers need:
- A **stable unit** (MUSD) backed by Bitcoin, not another volatile chart.
- **Goal locks** that feel like a bank FD, not a DeFi farm.
- **Family remittance** with memos, not raw hex addresses only.

KhipuVault proved LatAm cooperative savings win; MezoPay proved consumer payments win. MUSD Pocket owns the **India FD + remit** wedge on the same MUSD rails.

## Challenges
- Mezo testnet faucet is CAPTCHA-gated; automated deploy from CI/box stops until a human funds the deployer.
- Testnet MUSD is borrowed (not dripped), so end-to-end demos need a one-time borrow against test BTC.
- WalletConnect project IDs / RainbowKit need a production `projectId` for reliable mobile wallet deep links.
- Early-fee economics must stay fair (capped at 5% in contract) while still shaping behavior.

## Technologies used
- **Solidity 0.8.28** + **Foundry** (london EVM per Mezo docs)
- **MUSDPocket** vault + remittance helper against canonical testnet MUSD
- **Vite + React + TypeScript**
- **wagmi / viem / RainbowKit** for Mezo Testnet (chain id `31611`)
- Mezo RPC `https://rpc.test.mezo.org`, explorer `https://explorer.test.mezo.org`

## How we built it
1. Researched Mezo docs, MUSD addresses, and past winners to pick an Access track wedge.
2. Designed `MUSDPocket.sol`: goals, deposits, timed withdraw, early fee, family allowlist, remittance events.
3. Wrote Foundry tests (unit + fuzz) — all green.
4. Built a UPI-inspired dark mobile UI with Goals / Save / Send tabs.
5. Generated a fresh testnet deployer wallet; documented faucet blocker for live deploy.

## What we learned
- Mezo’s EVM surface is familiar (Foundry/Hardhat), but **BTC-as-gas** and **borrow-to-get-MUSD** change onboarding vs typical L2 faucets.
- Consumer products on MUSD win when they **hide CDP complexity** and speak local money metaphors (FD, remit, family).
- Judging historically rewards **clear Mezo integration + shipped UX** over pure DeFi novelty.

## What’s next / Wave 2 roadmap
- Live Mezo testnet deploy + public demo URL
- Recurring auto-save (keeper / intent) into goals
- UPI-style QR pay links settling in MUSD
- Optional MEZO fee discounts / loyalty
- Fiat on-ramp partners for INR → MUSD corridor
- Security review + mainnet launch checklist

## Links (fill after deploy)
- Live app: _(local `npm run dev` until hosted)_
- Contract: _(pending faucet)_ · Explorer: https://explorer.test.mezo.org
- Repo: local git under `/workspace/buildathons/mezo` (push when ready)
- Demo video: see script below

---

## 60-second demo video script

**[0–8s]** Cold open on phone UI. Voiceover: “This is MUSD Pocket — Bitcoin-backed savings that feel like a bank FD, built on Mezo.”

**[8–18s]** Connect wallet → Mezo Testnet. Show MUSD balance. “Gas in BTC. Savings in MUSD — Mezo’s Bitcoin-backed stablecoin.”

**[18–32s]** Tap **Save** → create “Sister wedding” goal, 180-day lock, Family on. Approve + deposit 200 MUSD. Progress bar fills.

**[32–45s]** Switch to **Send**. Remit 50 MUSD to Ma with memo “Ma rent Oct”. Show explorer event with memo.

**[45–55s]** Back to Goals: early-withdraw warning (2% fee) vs wait for unlock. “Soft locks build the habit. Bitcoin backs the money.”

**[55–60s]** End card: “MUSD Pocket · Access & Distribution · Mezo Buildathon · @Cryptoboy_777”
