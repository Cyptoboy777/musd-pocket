/** Mezo testnet wallets that used MUSD Pocket. Builder keys and outside testers are separate lists. */
export { LIVE_APP } from "./facts";
export const EXPLORER = "https://explorer.test.mezo.org";

export type ProofWallet = {
  label: string;
  address: `0x${string}`;
  note: string;
  txs: { label: string; hash: `0x${string}` }[];
};

/**
 * Mainnet sMUSD vault seen on the Mezo explorer. The vault product page does not
 * publish this address. Pocket does not send goal balances there, and testnet has no code at it.
 */
export const SAVINGS_VAULT = {
  mainnet: "0xb4D498029af77680cD1eF828b967f010d06C51CC" as const,
  testnetHasCode: false,
  docs: "https://mezo.org/docs/users/mezo-earn/vaults/musd-savings-vault/",
};

/**
 * Builder-owned test wallets only. Outside testers belong in COMMUNITY_TESTERS.
 * Wallets 3-5 were generated and funded from the deployer during Wave 2.
 * Wallet 2 is the Wave 1 second test wallet.
 */
export const PROOF_WALLETS: ProofWallet[] = [
  {
    label: "My test wallet (deployer)",
    address: "0xA8F5Ce266d62430f4B83C94fC5ADfb737948d1EA",
    note: "My deployer. Opened a Mezo trove, created v1 and v2 goals, deposits, memo sends, early withdraw.",
    txs: [
      { label: "openTrove (1,800 MUSD)", hash: "0x55b2363a03a45078873efdd76a976cef0f0f6831b7beaf29bbf05549ee09a681" },
      { label: "v2 GoalCreated", hash: "0xc36a38916b40712fd10b20e7b47c942211257de4063c402919ea68f57e40d3cf" },
      { label: "v1 create + deposits (sample)", hash: "0x8b3f6c9b8ac810066ce930ec87d7696ea30390ec5011610c9af499bd3ecc353a" },
    ],
  },
  {
    label: "My own test wallet (Wave 1 second key)",
    address: "0xEEB0C4736e3ce84c85aEfe1BB63144422191509a",
    note: "My second test wallet from Wave 1. Funded by the deployer via memo payments, then deposited into a shared goal. Not a third-party user.",
    txs: [
      { label: "deposit into shared goal", hash: "0x052409282ba732dde3d923d7f83845d0f970d4b34535f1c1215500681a0e7ba6" },
    ],
  },
  {
    label: "My own test wallet (Wave 2 generated)",
    address: "0xF02F7c394713DCECfB94D993BB584b8cA5D4bb29",
    note: "Generated and funded from my deployer during Wave 2. Created v2 goal #2 and deposited 10 MUSD. Not a third-party user.",
    txs: [
      { label: "createGoal", hash: "0xf29b3f5be590ecba642a6195aa34b34c8b31883dda9357139539fb619e257ff6" },
      { label: "deposit", hash: "0xc3ac5680ba4b9ff3dc0d9a96645fdd1208dddacca08410e2ba7bb02e97a943be" },
    ],
  },
  {
    label: "My own test wallet (Wave 2 generated)",
    address: "0xa4824D70514a6a2a78CECe3d7D25549F0b472985",
    note: "Generated and funded from my deployer during Wave 2. Created v2 goal #3 and deposited 10 MUSD. Not a third-party user.",
    txs: [
      { label: "createGoal", hash: "0xdb50dbca4848c4bd3e6786883d0594166a6c06e4f7557ef3b95a03bc629ae8f6" },
      { label: "deposit", hash: "0x2217bf007fd35e70ffe75dde126d4115c8f9a50f14a05593ab152a08cdf04ea2" },
    ],
  },
  {
    label: "My own test wallet (Wave 2 generated)",
    address: "0x77eb4E81c9B9be068b2aE3fbA7545fFb28C2c580",
    note: "Generated and funded from my deployer during Wave 2. Created v2 goal #4 and deposited 10 MUSD. Not a third-party user.",
    txs: [
      { label: "createGoal", hash: "0x5cc2f40dafc78fbdc74cdea2de1bb9f5b1aac31868863f5080da414833105eb3" },
      { label: "deposit", hash: "0x94e6caf48516b383c50d291c2a3f69eb793aecac9e8191a2597d1ce2a059dd64" },
    ],
  },
];

/** Outside wallets with a real MUSDPocket transaction. One confirmed tester. */
export const COMMUNITY_TESTERS: ProofWallet[] = [
  {
    label: "Community tester",
    address: "0x63EfDF0633a5Cf057103CcB7dd657C9bd7AEd2d1",
    note: "Outside tester. Created goal #10, Emergency fund, with a 1,000 MUSD target on 4 Nov 2026.",
    txs: [
      {
        label: "createGoal #10 Emergency fund",
        hash: "0x25051be7bd23ca4751d13723410bcc16e983614ec6327545f26efbed2ed73fc2",
      },
    ],
  },
];
