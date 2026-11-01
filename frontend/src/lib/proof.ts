/** Real Mezo testnet wallets that used MUSD Pocket. Do not invent entries. */
export const LIVE_APP = "https://musd-pocket-mezo.vercel.app";
export const EXPLORER = "https://explorer.test.mezo.org";

export type ProofWallet = {
  label: string;
  address: `0x${string}`;
  note: string;
  txs: { label: string; hash: `0x${string}` }[];
};

/** Documented mainnet Savings Vault (sMUSD). eth_getCode on Mezo testnet (31611) returns empty. */
export const SAVINGS_VAULT = {
  mainnet: "0xb4D498029af77680cD1eF828b967f010d06C51CC" as const,
  testnetHasCode: false,
  docs: "https://mezo.org/docs/users/mezo-earn/vaults/musd-savings-vault/",
};

export const PROOF_WALLETS: ProofWallet[] = [
  {
    label: "Deployer / saver",
    address: "0xA8F5Ce266d62430f4B83C94fC5ADfb737948d1EA",
    note: "Opened a Mezo trove, created v1 and v2 goals, deposits, memo sends, early withdraw.",
    txs: [
      { label: "openTrove (1,800 MUSD)", hash: "0x55b2363a03a45078873efdd76a976cef0f0f6831b7beaf29bbf05549ee09a681" },
      { label: "v2 GoalCreated", hash: "0xc36a38916b40712fd10b20e7b47c942211257de4063c402919ea68f57e40d3cf" },
      { label: "v1 create + deposits (sample)", hash: "0x8b3f6c9b8ac810066ce930ec87d7696ea30390ec5011610c9af499bd3ecc353a" },
    ],
  },
  {
    label: "Shared-goal contributor",
    address: "0xEEB0C4736e3ce84c85aEfe1BB63144422191509a",
    note: "Received memo payments, approved MUSD, deposited into shared Home deposit on v1.",
    txs: [
      { label: "deposit into shared goal", hash: "0x052409282ba732dde3d923d7f83845d0f970d4b34535f1c1215500681a0e7ba6" },
    ],
  },
  {
    label: "Wave 2 saver A",
    address: "0xF02F7c394713DCECfB94D993BB584b8cA5D4bb29",
    note: "Created Wave2 emergency goal #2 on v2 and deposited 10 MUSD.",
    txs: [
      { label: "createGoal", hash: "0xf29b3f5be590ecba642a6195aa34b34c8b31883dda9357139539fb619e257ff6" },
      { label: "deposit", hash: "0xc3ac5680ba4b9ff3dc0d9a96645fdd1208dddacca08410e2ba7bb02e97a943be" },
    ],
  },
  {
    label: "Wave 2 saver B",
    address: "0xa4824D70514a6a2a78CECe3d7D25549F0b472985",
    note: "Created Wave2 travel goal #3 on v2 and deposited 10 MUSD.",
    txs: [
      { label: "createGoal", hash: "0xdb50dbca4848c4bd3e6786883d0594166a6c06e4f7557ef3b95a03bc629ae8f6" },
      { label: "deposit", hash: "0x2217bf007fd35e70ffe75dde126d4115c8f9a50f14a05593ab152a08cdf04ea2" },
    ],
  },
  {
    label: "Wave 2 saver C",
    address: "0x77eb4E81c9B9be068b2aE3fbA7545fFb28C2c580",
    note: "Created Wave2 festival goal #4 on v2 and deposited 10 MUSD.",
    txs: [
      { label: "createGoal", hash: "0x5cc2f40dafc78fbdc74cdea2de1bb9f5b1aac31868863f5080da414833105eb3" },
      { label: "deposit", hash: "0x94e6caf48516b383c50d291c2a3f69eb793aecac9e8191a2597d1ce2a059dd64" },
    ],
  },
];
