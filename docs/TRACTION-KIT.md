# Traction kit: get outside wallets to deposit

Judges scored Product & Business Viability lowest (4/10) and asked for outside wallets that
**deposit and chip in**, not only create goals. This page is the weekly plan. Use
`docs/TESTER-GUIDE.md` as the step-by-step for each tester.

## What counts (and what does not)

- Counts: a wallet you do not control that makes a **deposit or chip-in** on a goal, with an explorer link.
- Does not count: goals created and left empty, your own second wallets, wallets you funded yourself.
- Only report numbers you can link to on the explorer. Judges check.

## Weekly target

| Week | Outside wallets that deposit | Chip-ins on shared goals | Notes |
|------|------------------------------|--------------------------|-------|
| 1 | 5 | 3 | Friends and Mezo Discord testers |
| 2 | 10 | 8 | Add the first mainnet cap test if v3 is ready |
| 3 | 20 | 15 | Ask each tester to invite one person |

Keep a real tracker: wallet (shortened), date, action, explorer link, tester feedback.
Leave it blank until it is true.

## Where to find testers

- Mezo Discord testnet / builders channels (post once, answer replies the same day).
- Akindo wave channel and other builders in the same wave (swap tests: you test theirs, they test yours).
- Friends who already hold BTC and are curious about MUSD.
- Ask each person to **chip in on a shared goal**, because that makes a second wallet transact.

## One-link flow (lowest friction)

1. Create a shared goal (e.g. "Test goal: chip in 5 MUSD").
2. Send the **invite link**: the invite page lets people read the goal before connecting a wallet.
3. Add their address as a contributor when they reply.
4. They follow `TESTER-GUIDE.md` steps 2-6. Plain deposit works; they do not need a 2,000 MUSD loan.

## Message to post (edit freely)

> I'm building MUSD Pocket on Mezo testnet: dated savings goals in MUSD, shared goals friends
> can chip into, and a loan-protection panel for borrowers. I need 5 testers to make one real
> deposit or chip-in (5 minutes, test tokens only). Guide: <link to TESTER-GUIDE>. App:
> https://musd-pocket-mezo.vercel.app. If you try it, send me your wallet and what felt confusing.

## Ask every tester two questions

1. Where did you get stuck? (This feeds the UX score.)
2. Would you use this with real MUSD? Why or why not? (This feeds the business case.)

## Mainnet gate

Do not announce mainnet until: PR #12 merged and tested, v3 passed `docs/V3-DESIGN.md` section 4,
the deployed contract matches the repo source, and there is a small per-goal and total deposit cap.
