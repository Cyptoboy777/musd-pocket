import { SAVINGS_VAULT } from "../lib/proof";
import { IconExternal, IconShield } from "./Icons";
import type { Lang } from "../lib/i18n";
import { t } from "../lib/i18n";

/**
 * Pocket does not route savings through Mezo's sMUSD vault.
 * The note stays visible so a loan's collateral ratio is not confused with vault yield.
 */
export function SavingsVaultPanel({ lang = "en" }: { lang?: Lang }) {
  return (
    <div className="panel vault-panel" data-feature="smusd-vault" aria-labelledby="vault-title">
      <div className="account-row">
        <h3 id="vault-title"><IconShield width={16} height={16} /> MUSD Savings Vault</h3>
        <span className="status">Separate product</span>
      </div>
      <p className="btc-copy">{t(lang, "vaultNotLive")}</p>
      <p className="btc-copy faint" data-feature="smusd-no-icr">{t(lang, "vaultNoIcr")}</p>
      <a className="link-out" href={SAVINGS_VAULT.docs} target="_blank" rel="noreferrer">
        Mezo Savings Vault docs <IconExternal width={13} height={13} />
      </a>
    </div>
  );
}
