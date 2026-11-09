import facts from "@facts" with { type: "json" };

/** Addresses, network, and test counts. Docs should match this file. */
export const FACTS = facts;

export const LIVE_APP = facts.liveUrl;
export const REPO_URL = facts.repo;

export const POCKET_V2_ADDRESS = facts.contracts.pocketV2 as `0x${string}`;
export const POCKET_V1_ADDRESS = facts.contracts.pocketV1 as `0x${string}`;
export const MUSD_TESTNET_ADDRESS = facts.contracts.musdTestnet as `0x${string}`;
