import { SAVINGS_VAULT } from "../lib/proof";
import { IconExternal, IconShield } from "./Icons";

/** sMUSD Savings Vault: documented on mainnet, verified empty on Mezo testnet. Never claims ICR benefit. */
export function SavingsVaultPanel() {
  return (
    <div className="panel vault-panel" aria-labelledby="vault-title">
      <div className="account-row">
        <h3 id="vault-title"><IconShield width={16} height={16} /> MUSD Savings Vault</h3>
        <span className="status">Testnet: not live</span>
      </div>
      <p className="btc-copy">
        Mezo documents an sMUSD Savings Vault on mainnet
        (<span className="tnum">{SAVINGS_VAULT.mainnet.slice(0, 8)}…</span>). We checked{" "}
        <code>eth_getCode</code> for that address on Mezo testnet (chain 31611): it has no code.
        Parking idle goal MUSD in sMUSD is therefore shown as documented-but-not-live here.
      </p>
      <p className="btc-copy faint">
        sMUSD is a receipt token for vault yield. It does not raise your trove ICR and is not wired into borrow-into-goal.
      </p>
      <a className="link-out" href={SAVINGS_VAULT.docs} target="_blank" rel="noreferrer">
        Mezo Savings Vault docs <IconExternal width={13} height={13} />
      </a>
    </div>
  );
}
