import { useEffect, useRef } from "react";
import { useToast } from "../components/Toasts";
import { mezoTestnet } from "../lib/chains";

export function humanizeError(err: unknown): string {
  const msg = (err as { shortMessage?: string; message?: string })?.shortMessage || (err as Error)?.message || "";
  if (/user rejected|denied|rejected the request/i.test(msg)) return "You declined the request in your wallet. Nothing was sent.";
  if (/insufficient funds/i.test(msg)) return "Not enough BTC for gas. Top up from the Mezo testnet faucet and try again.";
  if (/allowance|exceeds allowance/i.test(msg)) return "Approve MUSD first, then try again.";
  if (/chain|network/i.test(msg)) return "Switch your wallet to Mezo Testnet (chain 31611) and try again.";
  return msg.split("\n")[0].slice(0, 160) || "The transaction could not be sent.";
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
    else push({ id: key, kind: "error", title: "Transaction not sent", body: humanizeError(error) });
  }, [key, isPending, hash, confirming, success, error, doneTitle, push]);
}
