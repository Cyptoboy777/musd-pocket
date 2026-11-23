# MUSD Pocket: business model

Short version: Pocket is dated savings goals for MUSD on Mezo. It earns small fees, all visible
in the contract and controlled by a public timelock. Today only one fee is live. The rest are
planned and are labelled that way. There is no revenue yet, and no figure below is a measurement.

## Who it is for

Global Bitcoin holders who want stable, dollar-denominated savings with a date, without selling
their BTC. On Mezo they can borrow MUSD against BTC straight into a goal, let it earn in the MUSD
Savings Vault, let friends or family chip in, and let the goal repay their own loan if BTC falls.

Current traction, from [facts.json](../facts.json): 2 outside wallets have created goals, with
0 outside deposits and 0 chip-ins. See [JUDGE-FEEDBACK.md](JUDGE-FEEDBACK.md). We do not count our own wallets.

## What earns money

| Stream | Status | How it works |
|---|---|---|
| Early-unlock fee | **Live** | 2% default, 5% hard cap in the contract, stored per goal when created. Chip-ins and on-time withdrawals are free. Emergency repay is free when the goal is unlocked, the loan is under 200% collateral, or Mezo is in Recovery Mode; otherwise the same early-unlock fee applies. |
| Share of savings yield | Planned | A small cut of vault yield only, never of principal. **Not in the deployed v3 contract** (v3 credits all vault yield to the goal). Needs a new contract version, a fresh review and a fork test, and would be announced through the timelock. |
| Pocket Pro | Planned | Optional subscription: loan rebalance alerts, more goals, larger shared/family goals. Saving, borrowing into a goal and emergency repay stay free. |
| Embedded savings (B2B) | Planned | A widget or SDK so wallets and apps can offer dated goals on Mezo. Licensed per integration. |

### Who controls fees

The v3 owner is `PocketTimelock` with a 2-day delay
([`0xb6790A38…7990`](https://explorer.test.mezo.org/address/0xb6790A383679A3364E656dAd1E8fCf4195f37990)).
Fee changes and fee claims are queued in public before they run. The owner cannot move goal
balances or earned yield. The app shows this in its "How it earns" section.

## Revenue math (projection, not a forecast)

Every input is an assumption. None of it comes from Mezo or from our users.

| Assumption | Value |
|---|---|
| Average MUSD per saver | 500 |
| Share of balances withdrawn early per year | 10% |
| Early-unlock fee | 2% |
| Savings-vault yield (**assumed**, not a Mezo figure) | 4% a year |
| Planned fee on yield | 10% of yield |
| Savers on Pro | 3%, at 36 USD a year |
| Embedded integrations | 6,000 USD a year each |

| Total MUSD saved | Savers | Early fee | Yield fee | Pro | Embedded | Total per year |
|---|---|---|---|---|---|---|
| 100,000 | 200 | 200 | 400 | 216 | 0 (0) | **816** |
| 1,000,000 | 2,000 | 2,000 | 4,000 | 2,160 | 6,000 (1) | **14,160** |
| 10,000,000 | 20,000 | 20,000 | 40,000 | 21,600 | 18,000 (3) | **99,600** |

What this says plainly: fees on savings alone are small. Below about 1M MUSD saved this is a
side project, not a business. Growth has to come from many savers and, most of all, from other apps
embedding Pocket, because one integration is worth more than hundreds of individual Pro users.
If the assumptions are wrong (a lower vault yield, fewer early exits), the figures fall.

## Go to market

1. **Prove real use first.** Get outside wallets to deposit and chip in on testnet, with explorer links. Count only wallets we do not control.
2. **Ship mainnet small.** Mainnet deploy is done by the owner from their own wallet, with a small per-goal and total cap at first.
3. **Shared goals as the growth loop.** A goal with an invite link brings a second wallet in with each use.
4. **Then partners.** Offer the widget to wallets and apps in the Mezo ecosystem once there is real usage to point to. No partner is named here because there is none yet.

## Why Mezo

- MUSD is a Bitcoin-backed dollar, so the saver never has to sell BTC to hold stable savings.
- Mezo's own contracts do the hard parts: signature-relayed borrowing and repaying, live loan checks and the MUSD Savings Vault. Pocket composes them instead of rebuilding them.
- The lock can *lower* loan risk (a goal can repay its owner's loan), which only makes sense on a platform where the savings and the loan live together.

## Honest limits

- No revenue, no TVL and no partners are claimed.
- The yield fee, Pro and the SDK are not built. The contract change for a yield fee needs a redeploy and review.
- There is no sMUSD gauge on Mezo to build on, so none is used.
