MUSD Pocket tester guide (Mezo testnet)

This is a short guide you can send to a friend who wants to try MUSD Pocket on Mezo testnet. Simple English. No mainnet. No real money.

Live app: https://musd-pocket-mezo.vercel.app
(Do not use musd-pocket.vercel.app — that is another team's app.)

What you need
- A browser wallet (MetaMask or similar)
- About five minutes
- Willingness to use free test tokens only

Step 1 — Open the app
Go to https://musd-pocket-mezo.vercel.app
You should see "Mezo testnet" labelled in the UI. If a friend sent you an invite link, open that link instead. You can read the shared goal before connecting a wallet.

Step 2 — Add Mezo Testnet
Chain ID: 31611
RPC: https://rpc.test.mezo.org
Explorer: https://explorer.test.mezo.org
Currency: BTC (18 decimals on Mezo)
Many wallets can add the network from the app's Get test MUSD section, or use the invite page "Add / switch to Mezo Testnet" button.

Step 3 — Get free test BTC
Open https://faucet.test.mezo.org and request test BTC to your wallet address.
Gas on Mezo testnet is paid in test BTC.

Step 4 — Get test MUSD
In the app, open Get test MUSD.
You can swap a little test BTC for MUSD on https://testnet.mezo.org/feature/swap
or borrow MUSD against BTC on https://testnet.mezo.org/feature/borrow
Important: Mezo's minimum loan is about 1,800 MUSD principal plus a 200 MUSD gas deposit (about 2,000 MUSD total debt at open). Small savings goals should use plain MUSD deposit, not borrow-into-goal.

Step 5 — Connect and create a goal
Connect your wallet in the app (must be on Mezo Testnet 31611).
Open New goal, pick a name, target, and lock days, then create.
You can mark a goal Shared so friends can chip in after you add their address.

Step 6 — Deposit or chip in
Add MUSD from your wallet (one signature with permit), or borrow from your own Mezo loan straight into the goal if you have a healthy trove.
If you received an invite link, finish the four steps on that page and chip in once the goal owner has added you as a contributor.

Step 7 — Optional: protect a loan
If you have a Mezo loan, the Protect my loan panel shows live ICR and liquidation price, and can add collateral or repay with a preview before you send.

Step 8 — Send us proof (optional)
If you are happy to be listed as a community tester, send:
- your wallet address
- a short note of what you did (create / chip-in / memo)
- explorer links to your transactions (https://explorer.test.mezo.org/tx/...)
We only list real third-party wallets. No fake users.

Fees
- Early unlock: 2% of the locked balance (contract cap 5%)
- Chip-in: 0%
- Unlock on time: 0%

Safety
- Testnet only. Never send mainnet funds to testnet addresses.
- sMUSD savings vault is documented on mainnet but has no code on this testnet; the app says so honestly. sMUSD does not raise trove ICR.

Repo and contract
- GitHub: https://github.com/Cyptoboy777/musd-pocket
- MUSDPocket v2 (verified): 0xEC03F758219746b6e773f107a05cF17b66E7D460
