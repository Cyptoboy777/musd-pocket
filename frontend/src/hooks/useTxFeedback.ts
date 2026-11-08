import { useEffect, useRef } from "react";
import { useToast } from "../components/Toasts";
import { mezoTestnet } from "../lib/chains";

export type WalletErrorCopy = { title: string; body: string; notSubmitted: boolean };

/** User-facing copy. "Nothing was sent" only when this app knows it did not broadcast. */
export function walletErrorCopy(err: unknown): WalletErrorCopy {
  const msg = (err as { shortMessage?: string; message?: string })?.shortMessage || (err as Error)?.message || "";
  if (/user rejected|denied|rejected the request/i.test(msg)) {
    return { title: "Not sent", body: "You declined the request in your wallet. Nothing was sent.", notSubmitted: true };
  }
  if (/POCKET_TESTNET_ONLY/i.test(msg)) {
    return { title: "Not sent", body: "Savings goals are on Mezo testnet. Nothing was sent.", notSubmitted: true };
  }
  if (/insufficient funds/i.test(msg)) {
    return { title: "Not sent", body: "Not enough BTC for gas. Nothing was sent.", notSubmitted: true };
  }
  if (/APPROVAL_REVERTED/i.test(msg)) {
    return { title: "Approval did not succeed", body: "The approval did not succeed, so repayment was not submitted.", notSubmitted: false };
  }
  if (/APPROVAL_UNCONFIRMED|CHAIN_CHANGED/i.test(msg)) {
    return {
      title: "Check your wallet",
      body: "An earlier step was submitted and is not confirmed here. The next step was not submitted.",
      notSubmitted: false,
    };
  }
  if (/LoanTooRisky|StillLocked|NotContributor|NotGoalOwner|BadAmount|BadLock/i.test(msg)) {
    return { title: "Not completed", body: "The contract declined this action.", notSubmitted: false };
  }
  return {
    title: "Check your wallet",
    body: "This could not be completed. Check your wallet before trying again.",
    notSubmitted: false,
  };
}

export function humanizeError(err: unknown): string {
  return walletErrorCopy(err).body;
}

export const txUrl = (hash: string) => `${mezoTestnet.blockExplorers.default.url}/tx/${hash}`;

/** Maps a wagmi write + receipt lifecycle onto one updating toast. */
export function useTxFeedback(opts: {
  key: string;
  isPending: boolean;
  hash?: `0x${string}`;
  confirming: boolean;
  success: boolean;
  error: unknown;
  doneTitle: string;
}) {
  const { push } = useToast();
  const { key, isPending, hash, confirming, success, error, doneTitle } = opts;
  const last = useRef<string>("");

  useEffect(() => {
    let state = "";
    if (error) state = "error";
    else if (success && hash) state = "success:" + hash;
    else if (confirming && hash) state = "confirming:" + hash;
    else if (isPending) state = "pending";
    if (!state || state === last.current) return;
    last.current = state;
    if (state === "pending") push({ id: key, kind: "pending", title: "Confirm in your wallet…" });
    else if (state.startsWith("confirming")) push({ id: key, kind: "pending", title: "Submitted. Waiting for a block…", href: txUrl(hash!) });
    else if (state.startsWith("success")) push({ id: key, kind: "success", title: doneTitle, href: txUrl(hash!) });
    else {
      const copy = walletErrorCopy(error);
      push({ id: key, kind: "error", title: copy.title, body: copy.body });
    }
  }, [key, isPending, hash, confirming, success, error, doneTitle, push]);
}
