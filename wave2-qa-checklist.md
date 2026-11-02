# MUSD Pocket Wave 2 QA checklist (zero Wave 1 repeats)

Date: 2026-11-03 Asia/Calcutta  
Primary URL: https://musd-pocket-mezo.vercel.app  
Branch: wave2-pro → master  
Contract: 0xEC03F758219746b6e773f107a05cF17b66E7D460 (Mezo testnet 31611)

Legend: PASS = evidence attached this wave. OPEN = needs user (materials/recruitment). FAIL = must fix before merge.

## A. Wave 1 judge critiques (`civ_defi_mezo`)

| Critique | Status | Evidence |
|---|---|---|
| Integration L2: only plain ERC-20 MUSD | PASS | borrowToGoal composes BOS WithdrawMUSD: tx https://explorer.test.mezo.org/tx/0x15ee0df8a64757939921d4392b88909d5dfc2f0a69f1b14b407bfe780fcbba7f ; Protect addColl https://explorer.test.mezo.org/tx/0x2da3e12391fedcd94868e589525be5a5137c9eb4f18bbb3efd46b790edac0c22 ; repay https://explorer.test.mezo.org/tx/0x6bc4369125d44ec9863927812d96f3599accc976e17466383c4ca854e652fe5e |
| Borrow-into-goal existed but source not in repo / unverified / unused | PASS | Source `contracts/src/MUSDPocketV2.sol` in repo; explorer verified; UI GoalCard borrow mode; tx above |
| Wrong live link (`musd-pocket.vercel.app` collision) | PASS | README + app + Proof + submissions cite only https://musd-pocket-mezo.vercel.app |
| No live ICR / liquidation price | PASS | `BitcoinPanel` + borrow preview + Protect preview use TroveManager + PriceFeed (`frontend/src/lib/mezo.ts`, `risk.ts`) |
| Consider MUSD Savings vault | PASS | `SavingsVaultPanel` + `vault.ts` feature flag; honest empty on 31611; `data-feature="smusd-no-icr"` |
| Real users beyond two wallets | OPEN (honest) | Self wallets labelled in Proof; Community testers empty by design; `docs/TESTER-GUIDE.md` for recruiting. No fake users. |

## B. dsh_agent / builder notes

| Point | Status | Evidence |
|---|---|---|
| Debt floor 1,800 + 200 ≈ 2,000 MUSD | PASS | Loan readiness copy in `BitcoinPanel`; README; tester guide |
| Savings vault does not raise ICR | PASS | Copy in SavingsVaultPanel + ONCHAIN-ACTIVITY + tests `wave2.test.ts` flag honesty |
| Label testnet vs mainnet clearly | PASS | Footer `data-feature="testnet-badge"`; README banner; tester guide; never mix URLs |
| Real-user tx proof (3–5 outside wallets) | OPEN | Empty Community testers section `data-feature="community-testers-empty"` ready |
| Small goals cannot open troves | PASS | Loan readiness + borrow empty state pushes plain deposit |

## C. Materials / form (from winning plan)

| Item | Status | Evidence |
|---|---|---|
| Pitch deck present / Wave 1→2 slide | OPEN | Existing PDF `docs/MUSD-Pocket-Pitch-Deck.pdf` needs Wave 2 refresh by builder |
| Video ≤2:15 showing new flows | OPEN | Prior video https://youtu.be/v9pkZ0W2YDE must be re-shot for borrow+ICR+invite+proof |
| Track / team / existing-product fields | OPEN | Builder fills AKINDO form; draft copy in `wave2-submission.md` |
| Changelog Wave 1→2 | PASS | `docs/ONCHAIN-ACTIVITY.md`, README Wave 2 section, `wave2-submission.md` |
| Link hygiene | PASS | Primary URL locked; contract explorer links in Proof/README |

## D. Competitor gaps we must not leave open

| Rival strength | Our answer | Status |
|---|---|---|
| Doji / Surety: deep protocol + outside counterparties | L4 trove composition + invite/tester path; cannot fake users | PASS code / OPEN users |
| Feasy: trove + sMUSD savings metaphor | Consumer goals + honest sMUSD flag (no ICR lie) | PASS |
| MezoRoute: mainnet executor + clear risk UX | Testnet-only honesty + Protect ICR UX; mainnet = user decision later | PASS (testnet scope) |

## E. Feature acceptance (this build)

| Feature | Status | Evidence |
|---|---|---|
| Borrow-into-goal | PASS | UI + tx 0x15ee0df8…ba7f |
| Early-withdraw fee path | PASS | tx 0x136b1533…45c9 |
| Add collateral (Protect) | PASS | tx 0x2da3e123…0c22 |
| Repay | PASS | tx 0x6bc43691…fe5e (10 MUSD; larger repay blocked by min net debt — correct protocol behavior) |
| Close trove | PARTIAL | UI wired (`ProtectLoanPanel`); not re-exercised this run (insufficient test BTC for fresh trove after addColl). Documented in ONCHAIN-ACTIVITY |
| Invite link + chip-in E2E | PASS | Invite UI `data-feature="invite-landing"`; chip-in tx 0x83439819…d63f on shared goal #6 |
| Global i18n (en/es/pt/zh/fr) | PASS | `frontend/src/lib/i18n.ts`; no Hindi/Telugu; vitest `wave2.test.ts` |
| Revenue panel | PASS | `data-feature="revenue-model"` |
| Tests | PASS | 47 Foundry + 22 vitest |

## F. Production click-through QA (before/after merge)

Run against https://musd-pocket-mezo.vercel.app after merge.

| Check | Desktop ~1440 | Mobile ~390 | Evidence / notes |
|---|---|---|---|
| HTTP 200 | | | curl -I |
| Feature markers present (protect-loan, invite, revenue, smusd, community-empty, testnet-badge, lang-toggle) | | | page source / DOM |
| No console errors on load | | | DevTools |
| Nav Contract link opens explorer for 0xEC03… | | | |
| Proof self-wallet explorer links open | | | |
| Community testers empty (not faked) | | | |
| Wrong URL musd-pocket.vercel.app NOT linked | | | grep |
| Lang cycle EN→ES→PT→ZH→FR→EN | | | |
| Invite `?invite=6` shows landing without wallet | | | |
| Honest sMUSD "does not raise ICR" | | | |

(Fill F after preview + prod verification in this run.)

## G. Hard rules compliance

| Rule | Status |
|---|---|
| Mezo testnet only | PASS |
| No mainnet / no user real funds | PASS |
| No secrets committed | PASS (.env gitignored) |
| No fake community users | PASS |
| No posts to AKINDO/X/Discord/email | PASS |
| Core contract not redeployed | PASS (kept 0xEC03…D460) |
