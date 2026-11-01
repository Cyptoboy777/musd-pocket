import { useState } from "react";
import { useWaitForTransactionReceipt } from "wagmi";
import type { Hex } from "viem";
import { useTxFeedback } from "./useTxFeedback";

/** For flows that sign first (permit / Mezo EIP-712) and then send: one toast for the whole thing. */
export function useAsyncTx(key: string, doneTitle: string) {
  const [isPending, setPending] = useState(false);
  const [hash, setHash] = useState<Hex>();
  const [error, setError] = useState<unknown>(null);
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  useTxFeedback({ key, isPending, hash, confirming, success: isSuccess, error, doneTitle });

  async function run(fn: () => Promise<Hex>) {
    setError(null);
    setHash(undefined);
    setPending(true);
    try {
      setHash(await fn());
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return { run, hash, error, busy: isPending || confirming, success: isSuccess };
}
