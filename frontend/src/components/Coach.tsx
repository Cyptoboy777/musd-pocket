import { useMemo, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { buildPlan, parseGoal, type Plan } from "../lib/coach";
import type { MezoPosition } from "../lib/mezo";
import { IconCheck, IconDeposit, IconBitcoin, IconClock, IconSend } from "./Icons";

export type Draft = { name: string; target: string; days: string };

const PROMPTS = [
  "Save 1,200 for a trip to Goa by March",
  "Emergency fund: 3 months of rent at 800",
  "School fees 3k, I can put in 500 per month",
  "50 a week for a new laptop over 10 weeks",
];

const STEP_ICON = { wallet: IconDeposit, borrow: IconBitcoin, schedule: IconClock, swap: IconSend, "open-loan": IconBitcoin } as const;
const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });

/**
 * Pocket Coach. Type a goal in your own words; get a dated MUSD goal and a funding plan that uses
 * your real wallet balance and your Mezo loan. Rules-based and on-device: no API key, no server.
 */
export function Coach({ pos, walletMusd, connected, onUse }: { pos: MezoPosition; walletMusd: number; connected: boolean; onUse: (d: Draft) => void }) {
  const [text, setText] = useState("");
  const [asked, setAsked] = useState("");

  const plan: Plan | null = useMemo(() => {
    if (!asked.trim()) return null;
    return buildPlan(parseGoal(asked), { walletMusd: connected ? walletMusd : 0, trove: pos.trove, price: pos.price });
  }, [asked, walletMusd, pos.trove, pos.price, connected]);

  const ask = (q: string) => { setText(q); setAsked(q); };

  return (
    <div className="panel form coach">
      <div className="form-head">
        <h3>Pocket Coach</h3>
        <p>Say what you're saving for. The coach sets the amount and date, then plans how to fund it from your wallet and, if you have one, your Mezo loan, without pushing it under a safe ratio.</p>
      </div>
      <form className="coach-ask" onSubmit={(e) => { e.preventDefault(); setAsked(text); }}>
        <label htmlFor="coach-q" className="sr-only">Your goal</label>
        <textarea id="coach-q" rows={2} maxLength={200} placeholder="e.g. Save 1,200 for a trip to Goa by March" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setAsked(text); } }} />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>Plan it</button>
      </form>
      <div className="presets" role="group" aria-label="Try an example">
        {PROMPTS.map((p) => (
          <button type="button" key={p} className={`chip ${asked === p ? "chip-on" : ""}`} onClick={() => ask(p)}>{p}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {plan && (
          <m.div key={asked} className="coach-plan" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} aria-live="polite">
            <div className="coach-goal">
              <div>
                <span className="float-label">Suggested goal</span>
                <strong className="coach-goal-name">{plan.goal.name}</strong>
              </div>
              <dl className="coach-figs tnum">
                <div><dt>Target</dt><dd>{money(plan.goal.target)} MUSD</dd></div>
                <div><dt>Unlocks</dt><dd>{plan.goal.unlock.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</dd></div>
                <div><dt>Per week</dt><dd>{money(plan.perWeek)}</dd></div>
              </dl>
            </div>

            <ol className="coach-steps">
              {plan.steps.map((s, i) => {
                const Icon = STEP_ICON[s.kind];
                return (
                  <li key={i} className={`coach-step step-${s.kind}`}>
                    <span className="coach-step-icon"><Icon width={16} height={16} /></span>
                    <div><strong>{s.title}</strong><p>{s.body}</p></div>
                  </li>
                );
              })}
            </ol>

            {plan.risk && (
              <div className="coach-risk tnum">
                <span>Loan ratio <b>{Math.round(plan.risk.now * 100)}%</b> → <b>{Math.round(plan.risk.after * 100)}%</b> ({plan.risk.label})</span>
                <span>Liquidation if BTC drops below ${money(plan.risk.liqPrice)}</span>
              </div>
            )}
            {plan.warnings.map((w) => <div key={w} className="notice notice-warn" role="note"><span>{w}</span></div>)}
            {!connected && <p className="faint">Connect a wallet and the plan uses your real MUSD balance and Mezo loan.</p>}

            <button type="button" className="btn btn-primary btn-block btn-lg"
              onClick={() => onUse({ name: plan.goal.name, target: String(plan.goal.target), days: String(plan.goal.days) })}>
              <IconCheck /> Use this goal
            </button>
            <p className="coach-foot faint">Runs in your browser with fixed rules, so nothing you type leaves this page. It plans; you sign every step.</p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
