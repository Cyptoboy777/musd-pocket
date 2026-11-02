import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { SAVINGS_VAULT } from "../lib/proof";
import { SMUSD_VAULT_ADDRESS, hasBytecode } from "../lib/vault";
import { mezoTestnet } from "../lib/chains";
import { IconExternal, IconShield } from "./Icons";
import type { Lang } from "../lib/i18n";
import { t } from "../lib/i18n";

/**
 * sMUSD "earn while locked" behind a feature flag that only activates if vault
 * bytecode exists on the connected chain. Clear "does not raise ICR" note.
 * On testnet keep the honest empty panel.
 */
export function SavingsVaultPanel({ lang = "en" }: { lang?: Lang }) {
  const client = usePublicClient({ chainId: mezoTestnet.id });
  const [live, setLive] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!client) {
          setLive(false);
          setChecked(true);
          return;
        }
        const code = await client.getBytecode({ address: SMUSD_VAULT_ADDRESS });
        if (!cancelled) {
          setLive(hasBytecode(code));
          setChecked(true);
        }
      } catch {
        if (!cancelled) { setLive(false); setChecked(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [client]);

  return (
    <div className="panel vault-panel" data-feature="smusd-vault" data-vault-live={live ? "1" : "0"} aria-labelledby="vault-title">
      <div className="account-row">
        <h3 id="vault-title"><IconShield width={16} height={16} /> MUSD Savings Vault</h3>
        <span className={`status ${live ? "status-ok" : ""}`}>
          {checked ? (live ? t(lang, "vaultEarn") : "Testnet: not live") : "Checking…"}
        </span>
      </div>
      {live ? (
        <>
          <p className="btc-copy">
            Vault bytecode is live on this chain. You can park idle locked MUSD for exchange-rate yield
            ({t(lang, "vaultEarn").toLowerCase()}). Feature flag: on.
          </p>
          <p className="btc-copy faint" data-feature="smusd-no-icr">{t(lang, "vaultNoIcr")}</p>
        </>
      ) : (
        <>
          <p className="btc-copy">
            Mezo documents an sMUSD Savings Vault on mainnet
            (<span className="tnum">{SAVINGS_VAULT.mainnet.slice(0, 8)}…</span>). We checked{" "}
            <code>eth_getCode</code> for that address on Mezo testnet (chain 31611): it has no code.
            {t(lang, "vaultNotLive")}
          </p>
          <p className="btc-copy faint" data-feature="smusd-no-icr">{t(lang, "vaultNoIcr")}</p>
        </>
      )}
      <a className="link-out" href={SAVINGS_VAULT.docs} target="_blank" rel="noreferrer">
        Mezo Savings Vault docs <IconExternal width={13} height={13} />
      </a>
    </div>
  );
}
