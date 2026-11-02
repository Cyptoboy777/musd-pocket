/**
 * Pocket Coach: turns a sentence like "save 1,200 for a trip to Lisbon by March" into a dated
 * MUSD goal and a plan to fund it, using the wallet's real MUSD balance and Mezo loan.
 *
 * It is deliberately rules-based and runs entirely in the browser: no API key, no server,
 * nothing about your money leaves the page, and the same input always gives the same answer.
 */
import {
  COMFORT, MIN_NET_DEBT, POCKET_FLOOR, BAND_COPY, band, btcNeededFor, dropToLiquidation,
  liquidationPrice, maxBorrowAt, ratio, ratioAfterBorrow, type Trove,
} from "./risk";

export type Parsed = {
  name: string;
  target?: number;
  days?: number;
  perPeriod?: { amount: number; period: "week" | "month" };
  notes: string[];
};

export type Context = {
  walletMusd: number;
  trove?: Trove; // undefined = no Mezo loan
  price?: number; // BTC price in USD from Mezo's PriceFeed
  now?: Date;
};

export type Step = {
  kind: "wallet" | "borrow" | "schedule" | "swap" | "open-loan";
  title: string;
  body: string;
  amount?: number;
};

export type Plan = {
  goal: { name: string; target: number; days: number; unlock: Date };
  perWeek: number;
  perMonth: number;
  steps: Step[];
  risk?: { now: number; after: number; liqPrice: number; drop: number; label: string };
  warnings: string[];
  summary: string;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const KINDS: { re: RegExp; name: string }[] = [
  { re: /emergenc|rainy|safety net|buffer/, name: "Emergency fund" },
  { re: /school|tuition|college|fees|education|course/, name: "School fees" },
  { re: /wedding|marriage/, name: "Wedding" },
  { re: /trip|travel|vacation|holiday|flight|tour/, name: "Travel" },
  { re: /laptop|computer|macbook|pc\b/, name: "New laptop" },
  { re: /phone|iphone|android/, name: "New phone" },
  { re: /rent/, name: "Rent buffer" },
  { re: /house|home|flat|apartment|down ?payment/, name: "Home deposit" },
  { re: /car|bike|scooter|motorbike/, name: "Vehicle" },
  { re: /gift|birthday|christmas|diwali|eid|festival/, name: "Gifts" },
  { re: /medical|hospital|health|doctor/, name: "Medical fund" },
  { re: /tax/, name: "Tax bill" },
];

function num(s: string): number {
  const m = s.replace(/[,\s]/g, "").match(/^\$?(\d+(?:\.\d+)?)(k|m)?$/i);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  return m[2]?.toLowerCase() === "k" ? n * 1000 : m[2]?.toLowerCase() === "m" ? n * 1_000_000 : n;
}

const clampDays = (d: number) => Math.min(730, Math.max(1, Math.round(d)));

/** Days from `now` until the next occurrence of month `mi` (end of that month's 1st week). */
function daysUntilMonth(mi: number, now: Date, year?: number): number {
  let y = year ?? now.getFullYear();
  let target = new Date(y, mi, 1);
  if (!year && target <= now) target = new Date(++y, mi, 1);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

export function parseGoal(input: string, now = new Date()): Parsed {
  const text = input.toLowerCase();
  const notes: string[] = [];
  const out: Parsed = { name: "Savings goal", notes };

  const kind = KINDS.find((k) => k.re.test(text));
  if (kind) out.name = kind.name;
  const forWhat = input.match(/\bfor (?:a |an |my |the |our )?([A-Za-z][A-Za-z' ]{2,28}?)(?=\s+(?:by|in|before|until|within|over|next|this|at|and|,)\b|[.,!]|$)/);
  if (forWhat && !kind) out.name = forWhat[1].trim().replace(/^\w/, (c) => c.toUpperCase());

  // Recurring contributions: "50 a week", "200 per month", "100/month", "weekly 40"
  const per = text.match(/\$?(\d[\d,]*(?:\.\d+)?k?)\s*(?:musd|usd|dollars|\$)?\s*(?:a|per|each|every|\/)\s*(week|wk|month|mo)\b/);
  if (per) out.perPeriod = { amount: num(per[1]), period: per[2].startsWith("w") ? "week" : "month" };

  // "N months of rent/expenses at 800" → target
  const monthsOf = text.match(/(\d+)\s*months?\s*(?:of|worth of)\s*(?:rent|expenses|salary|bills|costs)[^\d]*(\d[\d,]*(?:\.\d+)?k?)/);
  if (monthsOf) {
    out.target = parseInt(monthsOf[1], 10) * num(monthsOf[2]);
    notes.push(`${monthsOf[1]} months × ${num(monthsOf[2]).toLocaleString("en-US")} = ${out.target.toLocaleString("en-US")} MUSD`);
  }

  // Target: the largest amount that isn't the recurring one or a year
  if (out.target === undefined) {
    const amounts = [...text.matchAll(/\$?(\d[\d,]*(?:\.\d+)?k?)\s*(musd|usd|dollars|bucks)?/g)]
      .filter((m) => {
        const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12);
        return !/^\s*(days?|weeks?|months?|years?|yrs?|d\b|w\b)/.test(after);
      })
      .map((m) => num(m[1]))
      .filter((n) => Number.isFinite(n) && n > 0 && !(n >= 2024 && n <= 2035) && n !== out.perPeriod?.amount);
    if (amounts.length) out.target = Math.max(...amounts);
  }

  // Time frame
  const inN = text.match(/(?:in|within|over|for)\s+(\d+|a|an|one|two|three|six|twelve)\s*(day|week|month|year)s?/);
  const words: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, six: 6, twelve: 12 };
  if (inN) {
    const n = words[inN[1]] ?? parseInt(inN[1], 10);
    const unit = { day: 1, week: 7, month: 30.44, year: 365 }[inN[2] as "day" | "week" | "month" | "year"];
    out.days = n * unit;
  }
  const iso = text.match(/(20\d\d)-(\d\d)-(\d\d)/);
  if (out.days === undefined && iso) {
    out.days = (new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime() - now.getTime()) / 86_400_000;
  }
  const byMonth = text.match(/(?:by|before|until|in|end of)\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(20\d\d)?/);
  if (out.days === undefined && byMonth) {
    out.days = daysUntilMonth(MONTHS.indexOf(byMonth[1]), now, byMonth[2] ? +byMonth[2] : undefined);
  }
  if (out.days === undefined && /next year/.test(text)) out.days = daysUntilMonth(0, now, now.getFullYear() + 1);
  if (out.days === undefined && /end of (the )?year|this year/.test(text)) {
    out.days = (new Date(now.getFullYear(), 11, 31).getTime() - now.getTime()) / 86_400_000;
  }

  // Fill the missing piece from the other two
  if (out.perPeriod && out.days !== undefined && out.target === undefined) {
    const periods = out.days / (out.perPeriod.period === "week" ? 7 : 30.44);
    out.target = Math.round(out.perPeriod.amount * Math.max(1, Math.floor(periods)));
    notes.push(`${out.perPeriod.amount} a ${out.perPeriod.period} for ${Math.floor(periods)} ${out.perPeriod.period}s`);
  }
  if (out.perPeriod && out.target !== undefined && out.days === undefined && out.perPeriod.amount > 0) {
    const periods = Math.ceil(out.target / out.perPeriod.amount);
    out.days = periods * (out.perPeriod.period === "week" ? 7 : 30.44);
    notes.push(`${periods} ${out.perPeriod.period}s of ${out.perPeriod.amount}`);
  }

  if (out.days !== undefined) {
    const raw = out.days;
    out.days = clampDays(raw);
    if (raw > 730) notes.push("Pockets lock for at most 2 years, so the date was capped.");
    if (raw < 1) notes.push("That date has passed or is today, so the lock was set to 1 day.");
  }
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function buildPlan(p: Parsed, ctx: Context): Plan {
  const now = ctx.now ?? new Date();
  const target = r2(p.target ?? 500);
  const days = p.days ?? 90;
  const unlock = new Date(now.getTime() + days * 86_400_000);
  const weeks = Math.max(1, days / 7);
  const months = Math.max(1, days / 30.44);
  const warnings: string[] = [];
  const steps: Step[] = [];
  if (p.target === undefined) warnings.push("No amount found, so this uses 500 MUSD. Edit it before creating the goal.");
  if (p.days === undefined) warnings.push("No date found, so this uses 90 days. Edit it before creating the goal.");

  let gap = target;
  const fromWallet = Math.min(ctx.walletMusd, target);
  if (fromWallet > 0) {
    steps.push({
      kind: "wallet",
      title: `Put ${money(fromWallet)} MUSD in now`,
      body: fromWallet >= target
        ? "Your wallet already covers the whole goal. One signature moves it in."
        : "Start with what is in your wallet. One signature, no separate approval.",
      amount: r2(fromWallet),
    });
    gap = r2(target - fromWallet);
  }

  let risk: Plan["risk"];
  const price = ctx.price ?? 0;
  if (gap > 0 && ctx.trove && ctx.trove.debt > 0 && price > 0) {
    const t = ctx.trove;
    const now_ = ratio(t, price);
    const safe = maxBorrowAt(t, price, COMFORT);
    const floor = maxBorrowAt(t, price, POCKET_FLOOR);
    const borrow = r2(Math.min(gap, safe));
    if (borrow >= 1) {
      const after = ratioAfterBorrow(t, price, borrow);
      const tAfter = { coll: t.coll, debt: t.debt + borrow * 1.001 };
      risk = { now: now_, after, liqPrice: liquidationPrice(tAfter), drop: dropToLiquidation(tAfter, price), label: BAND_COPY[band(after)] };
      steps.push({
        kind: "borrow",
        title: `Borrow ${money(borrow)} MUSD from your Bitcoin, straight into the goal`,
        body: `Your Mezo loan goes from ${pct(now_)} to ${pct(after)}. BTC could fall ${pct(risk.drop)} (to about $${money(risk.liqPrice)}) before liquidation. You keep your BTC; the loan costs Mezo's fixed rate plus a 0.1% fee.`,
        amount: borrow,
      });
      gap = r2(gap - borrow);
    } else if (floor >= 1) {
      warnings.push(`Your loan is at ${pct(now_)}. Borrowing more would take it under the 200% we suggest, so the coach won't plan it. Add BTC on Mezo first, or save from income.`);
    } else {
      warnings.push(`Your loan is at ${pct(now_)}, close to the 150% floor. Don't borrow more right now; consider repaying some MUSD.`);
    }
    if (now_ < POCKET_FLOOR) warnings.push("Loans under 150% can be liquidated if Mezo enters Recovery Mode, and low-ratio loans are redeemed first.");
  }

  if (gap > 0) {
    if (!ctx.trove || ctx.trove.debt <= 0) {
      if (gap >= MIN_NET_DEBT && price > 0) {
        steps.push({
          kind: "open-loan",
          title: `Or open a Mezo loan for ${money(gap)} MUSD`,
          body: `At a comfortable 200% that needs about ${btcNeededFor(gap, price).toFixed(4)} BTC as collateral. Mezo's minimum loan is ${money(MIN_NET_DEBT)} MUSD.`,
          amount: gap,
        });
      } else {
        steps.push({
          kind: "swap",
          title: `Get ${money(gap)} MUSD by swapping a little BTC`,
          body: `Mezo's minimum loan is ${money(MIN_NET_DEBT)} MUSD, so for ${money(gap)} a swap on Mezo is simpler than borrowing.`,
          amount: gap,
        });
      }
    }
    steps.push({
      kind: "schedule",
      title: `Then add about ${money(gap / weeks)} MUSD a week`,
      body: `That is ${money(gap / months)} a month until ${unlock.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}. Breaking the lock early costs 2% (${money(target * 0.02)} MUSD if the goal is full).`,
      amount: r2(gap / weeks),
    });
  }

  const summary =
    gap <= 0
      ? `${p.name}: ${money(target)} MUSD, locked ${days} days. You can fund it today.`
      : `${p.name}: ${money(target)} MUSD over ${days} days, about ${money(target / weeks)} a week.`;

  return {
    goal: { name: p.name.slice(0, 64), target, days, unlock },
    perWeek: r2(target / weeks),
    perMonth: r2(target / months),
    steps,
    risk,
    warnings: [...p.notes.filter((n) => /capped|passed/.test(n)), ...warnings],
    summary,
  };
}
