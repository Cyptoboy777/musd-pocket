/** Shared-goal invite links. Friend can open without a wallet first. */

export type InviteParams = {
  goalId: bigint;
  owner?: `0x${string}`;
};

const GOAL_RE = /^\d+$/;

/** Parse `?invite=<goalId>` (and optional `&owner=0x…`) from a location search string. */
export function parseInvite(search: string): InviteParams | null {
  const q = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const raw = q.get("invite") || q.get("g");
  if (!raw || !GOAL_RE.test(raw)) return null;
  const goalId = BigInt(raw);
  if (goalId <= 0n) return null;
  const ownerRaw = q.get("owner");
  const owner = ownerRaw && /^0x[a-fA-F0-9]{40}$/.test(ownerRaw)
    ? (ownerRaw as `0x${string}`)
    : undefined;
  return { goalId, owner };
}

/** Build a shareable invite URL for a shared goal. */
export function buildInviteUrl(origin: string, goalId: bigint | number | string, owner?: string): string {
  const base = origin.replace(/\/$/, "");
  const id = typeof goalId === "bigint" ? goalId.toString() : String(goalId);
  const u = new URL(base);
  u.searchParams.set("invite", id);
  if (owner && /^0x[a-fA-F0-9]{40}$/.test(owner)) u.searchParams.set("owner", owner);
  u.hash = "invite";
  return u.toString();
}

/** True when this path/search should show the invite landing. */
export function isInviteLanding(search: string): boolean {
  return parseInvite(search) !== null;
}
