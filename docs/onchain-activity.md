# On-chain activity: MUSD Pocket on Mezo testnet

Real transactions against the deployed, unchanged `MUSDPocket` contract
[`0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8`](https://explorer.test.mezo.org/address/0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8) on Mezo testnet (chain 31611), using canonical testnet MUSD
[`0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`](https://explorer.test.mezo.org/address/0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503).
Nothing here is simulated. All transactions succeeded (`status = 1`). Times are IST (UTC+5:30) on 21 Oct 2026.

**Wallets** (testnet only)
- Deployer / saver: [`0xA8F5Ce266d62430f4B83C94fC5ADfb737948d1EA`](https://explorer.test.mezo.org/address/0xA8F5Ce266d62430f4B83C94fC5ADfb737948d1EA)
- Second wallet, used as the shared-goal contributor and memo recipient: [`0xEEB0C4736e3ce84c85aEfe1BB63144422191509a`](https://explorer.test.mezo.org/address/0xEEB0C4736e3ce84c85aEfe1BB63144422191509a)

## How the MUSD was obtained

The deployer had test BTC from the faucet and no MUSD. It opened a Mezo trove by calling
`BorrowerOperations.openTrove` ([`0xCdF7…beE5`](https://explorer.test.mezo.org/address/0xCdF7028ceAB81fA0C6971208e83fa7872994beE5))
with 0.04 test BTC as collateral and 1,800 MUSD of debt, the protocol minimum
(total debt about 2,001.8 MUSD including the 200 MUSD gas deposit and the 0.1% fee).
This is the same borrow route a user follows at testnet.mezo.org. The other route is swapping BTC for MUSD there.

## Transactions

| # | Action | From | Block | Time (IST) | Tx |
|---|---|---|---|---|---|
| 0 | Borrow 1,800 MUSD against 0.04 test BTC (Mezo BorrowerOperations.openTrove) | deployer | 16,284,477 | 21 Oct 23:37:25 | [`0x55b2363a…09a681`](https://explorer.test.mezo.org/tx/0x55b2363a03a45078873efdd76a976cef0f0f6831b7beaf29bbf05549ee09a681) |
| 1 | Approve MUSD for MUSDPocket (deployer) | deployer | 16,284,488 | 21 Oct 23:38:17 | [`0xeed51513…02e747`](https://explorer.test.mezo.org/tx/0xeed515132645f801733a35a2074b9ef4a3284cff3c77b1726493204f3402e747) |
| 2 | Create goal #1 Emergency fund (1,000 MUSD, 90 days) | deployer | 16,284,489 | 21 Oct 23:38:25 | [`0x8b3f6c9b…cc353a`](https://explorer.test.mezo.org/tx/0x8b3f6c9b8ac810066ce930ec87d7696ea30390ec5011610c9af499bd3ecc353a) |
| 3 | Create goal #2 Travel (600 MUSD, 120 days) | deployer | 16,284,490 | 21 Oct 23:38:29 | [`0x130bf646…7b1ee9`](https://explorer.test.mezo.org/tx/0x130bf6467e32ee67b946c19e1e6022ebd59c4103787910e94fff63d50e7b1ee9) |
| 4 | Create shared goal #3 Home deposit (5,000 MUSD, 365 days) | deployer | 16,284,491 | 21 Oct 23:38:32 | [`0xad90ebdc…7d5b42`](https://explorer.test.mezo.org/tx/0xad90ebdcdb310de0ee2f14a141eed56f268af1f7a63c099d338113dbd67d5b42) |
| 5 | Deposit 250 MUSD into #1 Emergency fund | deployer | 16,284,492 | 21 Oct 23:38:40 | [`0x6357511c…55ee4f`](https://explorer.test.mezo.org/tx/0x6357511c1721a0b3dcb417b42c3f9ca01925ab5c0dc8ee338ee902f20e55ee4f) |
| 6 | Deposit 120 MUSD into #2 Travel | deployer | 16,284,493 | 21 Oct 23:38:44 | [`0xe09823b6…b98ad4`](https://explorer.test.mezo.org/tx/0xe09823b65b2f9f2c9df82ebc5b91536652b2996eefdbccc87efcd1e0a9b98ad4) |
| 7 | Deposit 120 MUSD into #2 Travel (second top-up) | deployer | 16,284,495 | 21 Oct 23:38:51 | [`0x01e5db71…01fc8e`](https://explorer.test.mezo.org/tx/0x01e5db71e500e963a71fb008d260b6c46ea2c309401d02fe23b8e7370201fc8e) |
| 8 | Approve MUSD for MUSDPocket (deployer, top-up) | deployer | 16,284,502 | 21 Oct 23:39:24 | [`0x04e57831…207cdf`](https://explorer.test.mezo.org/tx/0x04e5783127dd3db12eb6a36f89fdd838ed9b75db57d1335f2a022e41d4207cdf) |
| 9 | Deposit 300 MUSD into shared #3 Home deposit | deployer | 16,284,505 | 21 Oct 23:39:39 | [`0x7f466437…eef54f`](https://explorer.test.mezo.org/tx/0x7f466437417d91fd1ec54c2607282cff291b57b25c372932c0fd6f881eeef54f) |
| 10 | Add contributor to shared #3 (setFamilyMember) | deployer | 16,284,506 | 21 Oct 23:39:47 | [`0x60ec34f1…15219e`](https://explorer.test.mezo.org/tx/0x60ec34f1c83fee0ef5245dd029e069ca5b55d87dc5c0b4044cd8939a3f15219e) |
| 11 | Memo payment 60 MUSD: "Gift toward the home deposit" | deployer | 16,284,507 | 21 Oct 23:39:51 | [`0xb39c28ad…abb5fc`](https://explorer.test.mezo.org/tx/0xb39c28ada737536cd89257cf913be489bdc10710d78a4f5c4bd8bb6040abb5fc) |
| 12 | Memo payment 25 MUSD: "Dinner split, 21 Oct" | deployer | 16,284,509 | 21 Oct 23:39:58 | [`0xe144c701…0402f7`](https://explorer.test.mezo.org/tx/0xe144c7014a88692faa4d3e342ffea97f0c83adae7cc71fc923ff1333b30402f7) |
| 13 | Gas top-up 0.0005 test BTC to contributor wallet | deployer | 16,284,528 | 21 Oct 23:41:31 | [`0x417fcd16…b2600a`](https://explorer.test.mezo.org/tx/0x417fcd16831834529735d504823bdbb7df7a68da42c9088be7800370beb2600a) |
| 14 | Contributor approves 50 MUSD | contributor | 16,284,529 | 21 Oct 23:41:34 | [`0x66c4461a…f99f61`](https://explorer.test.mezo.org/tx/0x66c4461a8a8224bc51715da00f5d32d41c60812fdde715821b4884a899f99f61) |
| 15 | Contributor deposits 50 MUSD into shared #3 Home deposit | contributor | 16,284,530 | 21 Oct 23:41:38 | [`0x05240928…0e7ba6`](https://explorer.test.mezo.org/tx/0x052409282ba732dde3d923d7f83845d0f970d4b34535f1c1215500681a0e7ba6) |
| 16 | Create goal #4 Rent buffer (800 MUSD, 30 days) | deployer | 16,284,531 | 21 Oct 23:41:46 | [`0x88da19e8…5072ab`](https://explorer.test.mezo.org/tx/0x88da19e8674c48cd3f43f9beb7967132b05215a57a83438bfe36dce1585072ab) |
| 17 | Deposit 100 MUSD into #4 Rent buffer | deployer | 16,284,532 | 21 Oct 23:41:49 | [`0xa6741fc6…9b0bb1`](https://explorer.test.mezo.org/tx/0xa6741fc697ac919c3240e93abb33897e6c59b2bab3e672691d1949d44e9b0bb1) |
| 18 | Early withdraw #4 Rent buffer (98 MUSD back, 2 MUSD fee) | deployer | 16,284,534 | 21 Oct 23:42:01 | [`0xfd5179bb…558b7d`](https://explorer.test.mezo.org/tx/0xfd5179bb89178c560fbef7570fa3708c1f1c32cec21c20274910a706d3558b7d) |

Row 6 and row 7 are two separate 120 MUSD deposits into Travel. The first `cast send` returned an RPC
error while waiting for its receipt, and the retry sent a second deposit. Both are real and both succeeded.

## Resulting contract state (read from chain after the run)

| Goal | Type | Target | Locked balance | Unlocks | Status |
|---|---|---|---|---|---|
| #1 Emergency fund | personal | 1,000 MUSD | 250 MUSD | 19 Jan 2027 | active |
| #2 Travel | personal | 600 MUSD | 240 MUSD | 18 Feb 2027 | active |
| #3 Home deposit | shared (2 contributors) | 5,000 MUSD | 350 MUSD | 21 Oct 2027 | active |
| #4 Rent buffer | personal | 800 MUSD | 0 | (closed early) | withdrawn early: 98 MUSD back, 2 MUSD fee |

- `feePool` = 2 MUSD (the 2% early-exit fee from #4). It has not been claimed.
- MUSD held by the contract = 842 = 250 + 240 + 350 + 2 fee, which matches the goal balances.
- Memo payments emitted `RemittanceSent` with memos "Gift toward the home deposit" (60 MUSD)
  and "Dinner split, 21 Oct" (25 MUSD). The recipient then used 50 MUSD of that to contribute to the shared goal.

## Reproduce / check

```bash
cast call 0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8 "getGoal(uint256)(address,string,uint256,uint256,uint64,bool,bool)" 3 --rpc-url https://rpc.test.mezo.org
cast call 0x2d5f1275ac326aE0253aAf1cF7b633f7Fec2A1C8 "feePool()(uint256)" --rpc-url https://rpc.test.mezo.org
```
