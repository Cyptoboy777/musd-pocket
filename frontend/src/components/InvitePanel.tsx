import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, isAddress } from "viem";
import { musdPocketAbi } from "../lib/abi";
import { POCKET_ADDRESS, mezoTestnet } from "../lib/chains";
import { useMezoActions } from "../lib/mezo";
import { parseInvite, buildInviteUrl } from "../lib/invite";
import { useAsyncTx } from "../hooks/useAsyncTx";
import { useTxFeedback } from "../hooks/useTxFeedback";
import { IconCheck, IconCopy, IconExternal, IconUsers } from "./Icons";
import type { Lang } from "../lib/i18n";
import { t } from "../lib/i18n";

const FAUCET = "https://faucet.test.mezo.org";
const EXPLORER = mezoTestnet.blockExplorers.default.url;
const CHAIN_PARAMS = {
  chainId: "0x7B6B", // 31611
  chainName: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: ["https://rpc.test.mezo.org"],
  blockExplorerUrls: [EXPLORER],
};

function fmt(n: bigint | undefined) {
  if (n === undefined) return "—";
  return Number(formatUnits(n, 18)).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Invite landing + chip-in. Works without a wallet first. */
export function InviteLanding({ lang = "en" }: { lang?: Lang }) {
  const invite = useMemo(() => parseInvite(typeof window !== "undefined" ? window.location.search : ""), []);
  const { address, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const actions = useMezoActions();
  const [amount, setAmount] = useState("10");
  const [copied, setCopied] = useState(false);
  const chip = useAsyncTx("invite-chip", "Chipped in");

  const goalId = invite?.goalId;
  const { data: goal, isLoading, error } = useReadContract({
    address: POCKET_ADDRESS,
    abi: musdPocketAbi,
    functionName: "getGoal",
    args: goalId !== undefined ? [goalId] : undefined,
    query: { enabled: goalId !== undefined },
  });
  const { data: isMember } = useReadContract({
    address: POCKET_ADDRESS,
    abi: musdPocketAbi,
    functionName: "familyMember",
    args: goalId !== undefined && address ? [goalId, address] : undefined,
    query: { enabled: !!address && goalId !== undefined },
  });

  if (!invite) return null;
  const [owner, name, target, balance, unlockTime, active, isFamily] = goal ?? [];
  const unlocked = unlockTime !== undefined ? new Date(Number(unlockTime) * 1000).toLocaleDateString() : "—";
  const canChip = !!isConnected && !!isFamily && (!!isMember || address?.toLowerCase() === (owner as string | undefined)?.toLowerCase());
  const isOwner = !!address && !!owner && address.toLowerCase() === (owner as string).toLowerCase();

  async function addNetwork() {
    const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) return;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_PARAMS.chainId }] });
    } catch {
      await eth.request({ method: "wallet_addEthereumChain", params: [CHAIN_PARAMS] });
    }
    try { switchChain?.({ chainId: mezoTestnet.id }); } catch { /* ignore */ }
  }

  function copyAddr() {
    if (!address) return;
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <section id="invite" className="invite-section" data-feature="invite-landing" aria-labelledby="invite-title">
      <div className="section-head">
        <h2 id="invite-title">{t(lang, "inviteTitle")}</h2>
        <p>{t(lang, "inviteSub")}</p>
      </div>

      <div className="invite-grid">
        <article className="panel invite-card">
          {isLoading ? (
            <span className="skeleton" style={{ height: 96 }} />
          ) : error || !goal || !active ? (
            <p className="btc-copy">This invite link points to a goal we could not load on Mezo testnet. Check the link or ask your friend for a fresh one.</p>
          ) : (
            <>
              <header className="proof-card-head">
                <h3>{name as string}</h3>
                {isFamily ? <span className="tag"><IconUsers width={14} height={14} /> Shared</span> : <span className="tag">Personal</span>}
              </header>
              <dl className="account-meta">
                <div><dt>Saved</dt><dd className="tnum">{fmt(balance as bigint)} / {fmt(target as bigint)} MUSD</dd></div>
                <div><dt>Unlocks</dt><dd>{unlocked}</dd></div>
                <div><dt>Owner</dt><dd className="tnum">{(owner as string).slice(0, 6)}…{(owner as string).slice(-4)}</dd></div>
                <div><dt>Goal #</dt><dd className="tnum">{goalId!.toString()}</dd></div>
              </dl>
              {!isFamily && (
                <p className="btc-copy faint">This goal is not marked shared. Only the owner can deposit. Ask them to create a shared goal.</p>
              )}
            </>
          )}
        </article>

        <article className="panel invite-card" data-feature="invite-onboarding">
          <h3>Guided setup (testnet)</h3>
          <ol className="invite-steps">
            <li>
              <strong>1. {t(lang, "inviteStep1")}</strong>
              <button type="button" className="btn btn-ghost btn-block" onClick={() => void addNetwork()}>Add / switch to Mezo Testnet</button>
            </li>
            <li>
              <strong>2. {t(lang, "inviteStep2")}</strong>
              <a className="btn btn-ghost btn-block" href={FAUCET} target="_blank" rel="noreferrer">Open faucet <IconExternal width={14} height={14} /></a>
            </li>
            <li>
              <strong>3. {t(lang, "inviteStep3")}</strong>
              <div className="invite-connect"><ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" /></div>
            </li>
            <li>
              <strong>4. {t(lang, "inviteStep4")}</strong>
              {!isConnected ? (
                <p className="btc-copy faint">Connect first. No wallet was required to read this page.</p>
              ) : canChip ? (
                <form className="fund" onSubmit={(e) => {
                  e.preventDefault();
                  if (Number(amount) > 0 && goalId !== undefined) {
                    void chip.run(() => actions.depositWithPermit(goalId, amount));
                  }
                }}>
                  <div className="field">
                    <label htmlFor="chip-amt">Amount</label>
                    <div className="input-wrap">
                      <input id="chip-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                      <span className="suffix">MUSD</span>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-block" disabled={chip.busy || !(Number(amount) > 0)} data-feature="invite-chip">
                    {chip.busy ? <span className="spinner" /> : <>{t(lang, "inviteChip")}</>}
                  </button>
                  {chip.hash && (
                    <a className="txline tnum" href={`${EXPLORER}/tx/${chip.hash}`} target="_blank" rel="noreferrer">
                      tx: {chip.hash.slice(0, 10)}… <IconExternal width={12} height={12} />
                    </a>
                  )}
                </form>
              ) : isOwner ? (
                <OwnerAddMember goalId={goalId!} />
              ) : (
                <div className="invite-need-member">
                  <p className="btc-copy">{t(lang, "inviteNeedMember")}</p>
                  {address && (
                    <button type="button" className="btn btn-soft btn-block" onClick={copyAddr}>
                      {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
                      {copied ? "Copied" : `Copy my address ${address.slice(0, 6)}…`}
                    </button>
                  )}
                </div>
              )}
            </li>
          </ol>
        </article>
      </div>
    </section>
  );
}

function OwnerAddMember({ goalId }: { goalId: bigint }) {
  const [member, setMember] = useState("");
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  useTxFeedback({ key: `add-member-${goalId}`, isPending, hash, confirming, success: isSuccess, error, doneTitle: "Friend added" });
  const bad = member.length > 0 && !isAddress(member);

  return (
    <form className="fund" onSubmit={(e) => {
      e.preventDefault();
      if (!isAddress(member)) return;
      writeContract({
        address: POCKET_ADDRESS, abi: musdPocketAbi, functionName: "setFamilyMember",
        args: [goalId, member as `0x${string}`, true], chainId: mezoTestnet.id,
      });
    }}>
      <p className="btc-copy">You own this goal. Add your friend's address so they can chip in.</p>
      <div className="field">
        <label htmlFor="member">Friend address</label>
        <input id="member" value={member} onChange={(e) => setMember(e.target.value.trim())} placeholder="0x…" spellCheck={false} aria-invalid={bad} />
        {bad && <span className="field-error">Invalid address</span>}
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={isPending || confirming || !isAddress(member)}>
        {(isPending || confirming) ? <span className="spinner" /> : "Add contributor"}
      </button>
      {hash && <a className="txline tnum" href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">tx: {hash.slice(0, 10)}…</a>}
    </form>
  );
}

/** Copy-invite control for shared goal owners (used inside GoalCard). */
export function InviteCopyButton({ goalId, owner, lang = "en" }: { goalId: bigint; owner?: string; lang?: Lang }) {
  const [copied, setCopied] = useState(false);
  const url = buildInviteUrl(typeof window !== "undefined" ? window.location.origin + window.location.pathname : "https://musd-pocket-mezo.vercel.app/", goalId, owner);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-block"
      data-feature="invite-copy"
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
      {copied ? t(lang, "inviteCopied") : t(lang, "inviteCopy")}
    </button>
  );
}

/** Hook: true when current URL is an invite landing. */
export function useIsInvite(): boolean {
  const [yes, setYes] = useState(false);
  useEffect(() => {
    setYes(parseInvite(window.location.search) !== null);
  }, []);
  return yes;
}

