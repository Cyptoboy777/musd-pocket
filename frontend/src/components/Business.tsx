import { FACTS } from "../lib/facts";
import { mezoTestnet } from "../lib/chains";
import { IconCheck, IconExternal } from "./Icons";

const EXPLORER = mezoTestnet.blockExplorers.default.url;
const TIMELOCK = FACTS.contracts.pocketV3Timelock as string;
const DELAY_DAYS = Math.round(Number(FACTS.contracts.pocketV3TimelockDelaySeconds) / 86400);

type Stream = {
  name: string;
  status: "Live" | "Planned";
  body: string;
  rate: string;
};

/** What Pocket earns. "Live" means the deployed contract does it today. Nothing here is a revenue figure. */
const STREAMS: Stream[] = [
  {
    name: "Early-unlock fee",
    status: "Live",
    rate: "2% of the amount, capped at 5% in the contract",
    body: "Charged only when someone leaves a goal before its date. Chip-ins and on-time withdrawals are free. The rate is stored on each goal when it is created, so it cannot change under you.",
  },
  {
    name: "Share of savings yield",
    status: "Planned",
    rate: "A small cut of yield only, never of your principal",
    body: "Goals earn in Mezo's MUSD Savings Vault today and keep all of that yield. A fee on yield needs a new contract version, and it would be announced through the public timelock first.",
  },
  {
    name: "Pocket Pro",
    status: "Planned",
    rate: "Optional subscription",
    body: "Rebalance alerts for your loan, more goals, and family or shared goals with more people. Saving, borrowing into a goal and emergency repay stay free.",
  },
  {
    name: "Embed it in other apps",
    status: "Planned",
    rate: "License for wallets and apps",
    body: "A widget or SDK so a wallet can offer dated savings goals on Mezo without building the contracts and loan checks itself.",
  },
];

/** Plain-language business model. Honest about what is live, what is planned, and that there are no revenue numbers yet. */
export function BusinessSection() {
  return (
    <section id="business" className="business" aria-labelledby="business-title">
      <div className="section-head">
        <h2 id="business-title">How it earns</h2>
        <p>Small fees, in the open. Nothing is hidden in the contract.</p>
      </div>
      <div className="biz-wrap">
        {STREAMS.map((s) => (
          <div className="panel biz-card" key={s.name}>
            <div className="biz-top">
              <h3>{s.name}</h3>
              <span className={`status ${s.status === "Live" ? "status-ok" : ""}`}>{s.status}</span>
            </div>
            <p className="biz-rate">{s.rate}</p>
            <p className="btc-copy">{s.body}</p>
          </div>
        ))}
      </div>
      <div className="biz-wrap biz-foot">
        <div className="panel biz-card">
          <h3>Who controls the fees</h3>
          <ul className="biz-list">
            <li><IconCheck width={15} height={15} /> Fees collect inside the contract. The owner is a timelock, so a fee change or a fee claim waits {DELAY_DAYS} days in public first.</li>
            <li><IconCheck width={15} height={15} /> The owner can never move goal balances or earned yield.</li>
          </ul>
          <a className="link-out" href={`${EXPLORER}/address/${TIMELOCK}`} target="_blank" rel="noreferrer">
            Timelock that controls fees <IconExternal width={13} height={13} />
          </a>
        </div>
        <div className="panel biz-card">
          <h3>Who it is for</h3>
          <p className="btc-copy">
            People who hold Bitcoin and want stable savings with a date, without selling their BTC. They can borrow MUSD against it
            into a goal, let it earn, and the goal can repay their loan if the market turns.
          </p>
          <p className="btc-copy">Revenue figures are not shown because there are none yet. Early-stage projections are in the project's business notes and are marked as projections.</p>
        </div>
      </div>
    </section>
  );
}
