# MUSD Pocket — AKINDO Submission Draft

> Paste into AKINDO manually. Do **not** auto-submit. Builder: Crypto boy (@Cryptoboy_777).

## Project name
**MUSD Pocket**

## Track
Access & Distribution

## Tagline
Bitcoin-backed savings goals and payments for everyone, powered by Mezo MUSD.

## What it does
MUSD Pocket is a mobile-first web app where users:
1. **Create time-locked savings goals** in MUSD (Emergency fund, Travel, New laptop, Home deposit…) with an unlock date.
2. **Deposit Bitcoin-backed MUSD** into a smart-contract vault that soft-locks until unlock.
3. **Invite family or friends** to chip into shared goals.
4. **Send MUSD to anyone** with an on-chain memo (“Rent buffer”, “Trip split”) so transfers are human-readable on explorers.
5. **Early-withdraw** if needed, paying a small fee into a protocol fee pool (discourages breaking the goal).

All balances settle in **MUSD on Mezo Testnet**. Gas is paid in **BTC**.

## The problem it solves
People everywhere save toward dated goals and send money to the people they care about, but crypto UX is still explorer-native. Savers and cross-border earners need:
- A **stable unit** (MUSD) backed by Bitcoin, not another volatile chart.
- **Goal locks** that feel like a term deposit, not a DeFi farm.
- **Payments with memos**, not raw hex addresses only.

KhipuVault proved LatAm cooperative savings win; MezoPay proved consumer payments win. MUSD Pocket owns the **goal-locked savings + memo payments** wedge on the same MUSD rails.

## Challenges
- Mezo testnet faucet is CAPTCHA-gated; automated deploy from CI/box had to wait until a human funded the deployer.
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
4. Built a mobile-first, premium web UI with Goals / Save / Send views.
5. Funded a fresh testnet deployer via the faucet and deployed `MUSDPocket` to Mezo testnet at `0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8`.
6. Hosted the Vite frontend on GitHub Pages via GitHub Actions.

## What we learned
- Mezo’s EVM surface is familiar (Foundry/Hardhat), but **BTC-as-gas** and **borrow-to-get-MUSD** change onboarding vs typical L2 faucets.
- Consumer products on MUSD win when they **hide CDP complexity** and speak familiar money metaphors (goals, term deposits, sending to family).
- Judging historically rewards **clear Mezo integration + shipped UX** over pure DeFi novelty.

## What’s next / Wave 2 roadmap
- Recurring auto-save (keeper / intent) into goals
- QR pay links settling in MUSD
- Optional MEZO fee discounts / loyalty
- Fiat on-ramp partners for local currency → MUSD
- Security review + mainnet launch checklist

## Links
- **Live demo:** https://cyptoboy777.github.io/musd-pocket/
- **MUSDPocket contract (Mezo testnet):** [`0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8`](https://explorer.test.mezo.org/address/0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8)
- **Deploy tx:** [`0x98181dcd…b61df6`](https://explorer.test.mezo.org/tx/0x98181dcdda80939a99ce5dbd33be70cc4081356f50561d9be46545b0eab61df6)
- **Repo:** https://github.com/Cyptoboy777/musd-pocket
- Demo video: see script below

---

## 60-second demo video script

**[0–8s]** Cold open on phone UI. Voiceover: “This is MUSD Pocket: Bitcoin-backed savings goals with a date, built on Mezo.”

**[8–18s]** Connect wallet → Mezo Testnet. Show MUSD balance. “Gas in BTC. Savings in MUSD — Mezo’s Bitcoin-backed stablecoin.”

**[18–32s]** Tap **Save** → create “Home deposit” goal, 180-day lock, Family on. Approve + deposit 200 MUSD. Progress bar fills.

**[32–45s]** Switch to **Send**. Send 50 MUSD to a friend with memo “Rent buffer Oct”. Show explorer event with memo.

**[45–55s]** Back to Goals: early-withdraw warning (2% fee) vs wait for unlock. “Soft locks build the habit. Bitcoin backs the money.”

**[55–60s]** End card: “MUSD Pocket · Access & Distribution · Mezo Buildathon · @Cryptoboy_777”
