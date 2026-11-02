/**
 * Plain-number math for Mezo MUSD loans (troves). Mirrors the MUSD protocol:
 *   ratio (ICR)       = collateral BTC × BTC price ÷ debt
 *   liquidation       below 110% (MCR), or below 150% (CCR) in Recovery Mode
 *   borrowing fee     0.1% of new debt, added to the loan
 *   opening a trove   minimum net debt 1,800 MUSD + 200 MUSD gas compensation
 *                     so total debt at open is at least ~2,000 MUSD
 * Pure functions so they can be unit-tested and reused by the coach.
 */

export const MCR = 1.1;
export const CCR = 1.5;
/** MUSD Pocket's contract refuses a borrow-to-goal that ends below this. */
export const POCKET_FLOOR = 1.5;
/** What we suggest people aim for. */
export const COMFORT = 2.0;
export const BORROW_FEE = 0.001;
/** Mezo minimum net debt when opening a trove (protocol). */
export const MIN_NET_DEBT = 1800;
/** Gas compensation locked into the loan at open (protocol). */
export const GAS_COMPENSATION = 200;
/** Total debt floor at open ≈ net + gas compensation (+ tiny fee). */
export const MIN_TOTAL_DEBT_AT_OPEN = MIN_NET_DEBT + GAS_COMPENSATION;

export type Trove = {
  coll: number; // BTC
  debt: number; // MUSD (principal + interest + pending)
};

export type Band = "none" | "comfortable" | "watch" | "risky" | "liquidatable";

export function ratio(t: Trove, price: number): number {
  if (t.debt <= 0) return Infinity;
  return (t.coll * price) / t.debt;
}

export function band(r: number): Band {
  if (!Number.isFinite(r)) return "none";
  if (r >= COMFORT) return "comfortable";
  if (r >= CCR) return "watch";
  if (r >= MCR) return "risky";
  return "liquidatable";
}

export const BAND_COPY: Record<Band, string> = {
  none: "No loan",
  comfortable: "Comfortable",
  watch: "Keep an eye on it",
  risky: "At risk",
  liquidatable: "Can be liquidated",
};

/** BTC price at which the loan hits 110% and can be liquidated. */
export function liquidationPrice(t: Trove): number {
  if (t.coll <= 0) return 0;
  return (MCR * t.debt) / t.coll;
}

/** Ratio after borrowing `amount` more MUSD (fee included). */
export function ratioAfterBorrow(t: Trove, price: number, amount: number): number {
  return ratio({ coll: t.coll, debt: t.debt + amount * (1 + BORROW_FEE) }, price);
}

/** Most MUSD you can borrow and still sit at `target` ratio. Never negative. */
export function maxBorrowAt(t: Trove, price: number, target: number): number {
  if (t.coll <= 0 || price <= 0) return 0;
  const room = (t.coll * price) / target - t.debt;
  return Math.max(0, Math.floor((room / (1 + BORROW_FEE)) * 100) / 100);
}

/** How far BTC can fall (as a fraction, 0.25 = 25%) before liquidation. */
export function dropToLiquidation(t: Trove, price: number): number {
  const lp = liquidationPrice(t);
  if (price <= 0 || lp <= 0) return 1;
  return Math.max(0, 1 - lp / price);
}

/** BTC collateral needed to open a fresh loan of `debt` MUSD at `target` ratio. */
export function btcNeededFor(debt: number, price: number, target = COMFORT): number {
  if (price <= 0) return 0;
  return (debt * (1 + BORROW_FEE) * target) / price;
}

/** BTC needed to open the protocol-minimum loan (~2,000 MUSD total debt) at comfort. */
export function btcNeededForMinLoan(price: number, target = COMFORT): number {
  return btcNeededFor(MIN_TOTAL_DEBT_AT_OPEN, price, target);
}


/** Ratio after adding `btc` more collateral (no debt change). */
export function ratioAfterAddColl(t: Trove, price: number, btc: number): number {
  return ratio({ coll: t.coll + Math.max(0, btc), debt: t.debt }, price);
}

/** Ratio after repaying `amount` MUSD (debt never below zero). */
export function ratioAfterRepay(t: Trove, price: number, amount: number): number {
  return ratio({ coll: t.coll, debt: Math.max(0, t.debt - Math.max(0, amount)) }, price);
}

/** True when ICR is in watch/risky/liquidatable — surface Protect CTA. */
export function needsProtection(r: number | undefined): boolean {
  if (r === undefined || !Number.isFinite(r)) return false;
  return r < COMFORT;
}

/** Warning level for Protect panel copy. */
export function protectLevel(r: number | undefined): "none" | "ok" | "watch" | "danger" {
  if (r === undefined || !Number.isFinite(r)) return "none";
  if (r >= COMFORT) return "ok";
  if (r >= CCR) return "watch";
  return "danger";
}
