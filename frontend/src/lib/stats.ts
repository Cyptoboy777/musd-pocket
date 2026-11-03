/** Public stats + share helpers for MUSD Pocket (Mezo testnet). */

import { PROOF_WALLETS } from "./proof";

/** Known builder/team test wallets — never present as third-party users. */
export const TEAM_TEST_WALLETS: readonly `0x${string}`[] = PROOF_WALLETS.map((w) => w.address);

const TEAM_SET = new Set(TEAM_TEST_WALLETS.map((a) => a.toLowerCase()));

export function isTeamTestWallet(addr?: string | null): boolean {
  if (!addr) return false;
  return TEAM_SET.has(addr.toLowerCase());
}

export function labelWallet(addr: string): string {
  if (isTeamTestWallet(addr)) return "Team test wallet";
  return "Wallet";
}

/** Early-withdraw fee = amount * bps / 10_000 (contract earlyFeeBps, default 200 = 2%). */
export function earlyFeeAmount(locked: bigint, bps: number): bigint {
  if (locked <= 0n || bps <= 0) return 0n;
  return (locked * BigInt(bps)) / 10_000n;
}

export function earlyFeePreview(locked: number, bps: number): { fee: number; net: number; pct: number } {
  const pct = bps / 100;
  const fee = locked * (bps / 10_000);
  return { fee, net: Math.max(0, locked - fee), pct };
}

export type ShareIntent = { id: "x" | "telegram" | "whatsapp" | "copy" | "native"; label: string; href?: string };

/** Build social share intents for an invite URL. */
export function shareIntents(url: string, text: string): ShareIntent[] {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  return [
    { id: "x", label: "Share on X", href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}` },
    { id: "telegram", label: "Telegram", href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}` },
    { id: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${encodedText}%20${encodedUrl}` },
    { id: "copy", label: "Copy link" },
    { id: "native", label: "Share" },
  ];
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export type StatsEventKind = "GoalCreated" | "Deposited" | "EarlyWithdrawn" | "BorrowedToGoal" | "Withdrawn";

export type StatsEvent = {
  kind: StatsEventKind;
  goalId: string;
  from?: string;
  amount?: string;
  txHash: `0x${string}`;
  blockNumber: bigint;
};
