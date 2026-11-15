import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  type Address,
  type Hex,
} from "viem";
import { FACTS } from "../lib/facts";
import { mezoMainnet } from "../lib/chains";
import {
  BORROWER_OPERATIONS,
  CREATION_BYTECODE_HASH,
  POCKET_CONSTRUCTOR,
  compareReadback,
  deployErrorCopy,
  encodePocketDeploy,
  formatBtcFromWei,
  mainnetDeployAllowed,
  mezoMainnetWalletParams,
  parseOwner,
} from "../lib/deployMainnet";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
};

const readAbi = [
  { type: "function", name: "musd", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "borrowerOpsSig", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "troveManager", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "priceFeed", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "pendingOwner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "earlyFeeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
] as const;

const ARG_ROWS = [
  {
    name: "musd",
    value: POCKET_CONSTRUCTOR.musd,
    source: "Mezo contracts reference",
    href: "https://mezo.org/docs/users/resources/contracts-reference/",
  },
  {
    name: "borrowerOperationsSignatures",
    value: POCKET_CONSTRUCTOR.borrowerOperationsSignatures,
    source: "mezo-org/musd v1.1.0 proxy",
    href: "https://github.com/mezo-org/musd/releases/tag/v1.1.0",
  },
  {
    name: "troveManager",
    value: POCKET_CONSTRUCTOR.troveManager,
    source: "mezo-org/musd v1.1.0 proxy",
    href: "https://github.com/mezo-org/musd/releases/tag/v1.1.0",
  },
  {
    name: "priceFeed",
    value: POCKET_CONSTRUCTOR.priceFeed,
    source: "mezo-org/musd v1.1.0 proxy",
    href: "https://github.com/mezo-org/musd/releases/tag/v1.1.0",
  },
] as const;

function metamask(): EthereumProvider | null {
  const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  if (!eth) return null;
  if (eth.providers?.length) return eth.providers.find((provider) => provider.isMetaMask) ?? null;
  return eth.isMetaMask ? eth : null;
}

function explorerUrl(kind: "tx" | "address", value: string) {
  return `${FACTS.mainnet.explorer}/${kind}/${value}`;
}

export function DeployTool() {
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [ownerInput, setOwnerInput] = useState("");
  const [ownerEdited, setOwnerEdited] = useState(false);
  const [gas, setGas] = useState<bigint | null>(null);
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [estimateNote, setEstimateNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [deployed, setDeployed] = useState<Address | null>(null);
  const [rows, setRows] = useState<ReturnType<typeof compareReadback> | null>(null);
  const [feeBps, setFeeBps] = useState<number | null>(null);
  const [pendingOwner, setPendingOwner] = useState<string | null>(null);

  const owner = useMemo(() => parseOwner(ownerInput), [ownerInput]);
  const ownerAddress = owner.ok ? owner.address : null;
  const onMainnet = mainnetDeployAllowed(chainId ?? undefined);

  useEffect(() => {
    if (account && !ownerEdited) setOwnerInput(account);
  }, [account, ownerEdited]);

  useEffect(() => {
    if (!ownerAddress) {
      setGas(null);
      setGasPrice(null);
      setEstimateNote("");
      return;
    }
    let cancelled = false;
    setEstimateNote("Estimating gas…");
    const client = createPublicClient({ chain: mezoMainnet, transport: http(FACTS.mainnet.rpc) });
    const data = encodePocketDeploy(ownerAddress);
    void (async () => {
      try {
        const [estimate, price] = await Promise.all([
          client.estimateGas({ account: ownerAddress, data }),
          client.getGasPrice(),
        ]);
        if (cancelled) return;
        setGas(estimate);
        setGasPrice(price);
        setEstimateNote("");
      } catch {
        if (cancelled) return;
        setGas(null);
        setGasPrice(null);
        setEstimateNote("Gas estimate is unavailable right now. You can still review the transaction in MetaMask.");
      }
    })();
    return () => { cancelled = true; };
  }, [ownerAddress]);

  async function connect() {
    setError("");
    const provider = metamask();
    if (!provider) {
      setError("Install MetaMask in this browser, then connect it here.");
      return;
    }
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      const chain = await provider.request({ method: "eth_chainId" }) as string;
      setAccount(accounts[0] as Address);
      setChainId(Number(chain));
    } catch (err) {
      setError(deployErrorCopy(err));
    }
  }

  async function switchChain() {
    setError("");
    const provider = metamask();
    if (!provider) {
      setError("Install MetaMask in this browser, then connect it here.");
      return;
    }
    const params = mezoMainnetWalletParams();
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: params.chainId }] });
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === 4902) {
        try {
          await provider.request({ method: "wallet_addEthereumChain", params: [params] });
        } catch (addErr) {
          setError(deployErrorCopy(addErr));
          return;
        }
      } else {
        setError(deployErrorCopy(err));
        return;
      }
    }
    const chain = await provider.request({ method: "eth_chainId" }) as string;
    setChainId(Number(chain));
  }

  async function deploy() {
    setError("");
    if (!owner.ok) {
      setError(owner.message);
      return;
    }
    const provider = metamask();
    if (!provider || !account) {
      setError("Connect MetaMask first.");
      return;
    }
    const chain = Number(await provider.request({ method: "eth_chainId" }));
    setChainId(chain);
    if (!mainnetDeployAllowed(chain)) {
      setError("Switch MetaMask to Mezo mainnet before deploying. Nothing was sent.");
      return;
    }
    setBusy(true);
    try {
      const wallet = createWalletClient({ account, chain: mezoMainnet, transport: custom(provider) });
      const hash = await wallet.sendTransaction({
        account,
        chain: mezoMainnet,
        data: encodePocketDeploy(owner.address),
      });
      setTxHash(hash);
      const client = createPublicClient({ chain: mezoMainnet, transport: http(FACTS.mainnet.rpc) });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) {
        setError("The transaction finished without a contract address. Check the explorer before trying again.");
        return;
      }
      setDeployed(receipt.contractAddress);
      const [musd, borrowerOpsSig, troveManager, priceFeed, contractOwner, pending, bps] = await Promise.all([
        client.readContract({ address: receipt.contractAddress, abi: readAbi, functionName: "musd" }),
        client.readContract({ address: receipt.contractAddress, abi: readAbi, functionName: "borrowerOpsSig" }),
        client.readContract({ address: receipt.contractAddress, abi: readAbi, functionName: "troveManager" }),
        client.readContract({ address: receipt.contractAddress, abi: readAbi, functionName: "priceFeed" }),
        client.readContract({ address: receipt.contractAddress, abi: readAbi, functionName: "owner" }),
        client.readContract({ address: receipt.contractAddress, abi: readAbi, functionName: "pendingOwner" }),
        client.readContract({ address: receipt.contractAddress, abi: readAbi, functionName: "earlyFeeBps" }),
      ]);
      setRows(compareReadback({
        musd: String(musd),
        borrowerOpsSig: String(borrowerOpsSig),
        troveManager: String(troveManager),
        priceFeed: String(priceFeed),
        owner: String(contractOwner),
      }, owner.address));
      setPendingOwner(String(pending));
      setFeeBps(Number(bps));
    } catch (err) {
      setError(deployErrorCopy(err));
    } finally {
      setBusy(false);
    }
  }

  const cost = gas !== null && gasPrice !== null ? gas * gasPrice : null;
  const matches = rows?.every((row) => row.match) && pendingOwner?.toLowerCase() === "0x0000000000000000000000000000000000000000" && feeBps === 200;

  return (
    <div className="page" data-feature="mainnet-deploy-tool">
      <main className="deploy-main">
        <h1>Deploy MUSD Pocket</h1>
        <p className="muted">
          This page is only on the Vercel preview. It is not part of the public app. MetaMask will ask you to create the contract on Mezo mainnet. Gas is BTC from the wallet you connect. We never see the key.
        </p>

        <section className="panel deploy-card">
          <h2>Wallet</h2>
          <p>{account ? account : "MetaMask is not connected."}</p>
          <p>Chain: {chainId === null ? "Unknown" : onMainnet ? "Mezo mainnet (31612)" : `Chain ${chainId}. Switch to Mezo mainnet.`}</p>
          <div className="btn-row">
            <button type="button" className="btn btn-ghost" onClick={() => void connect()}>Connect MetaMask</button>
            <button type="button" className="btn btn-ghost" onClick={() => void switchChain()} disabled={!account}>Switch to Mezo</button>
          </div>
        </section>

        <section className="panel deploy-card">
          <h2>Constructor arguments</h2>
          <table className="deploy-table">
            <tbody>
              {ARG_ROWS.map((row) => (
                <tr key={row.name}>
                  <th>{row.name}</th>
                  <td>
                    <code className="tnum">{row.value}</code>
                    <div className="muted"><a href={row.href}>{row.source}</a></div>
                  </td>
                </tr>
              ))}
              <tr>
                <th>initialOwner</th>
                <td>
                  <input
                    className="deploy-owner"
                    value={ownerInput}
                    spellCheck={false}
                    autoComplete="off"
                    aria-label="Contract owner"
                    onChange={(event) => {
                      setOwnerEdited(true);
                      setOwnerInput(event.target.value);
                    }}
                  />
                  {!owner.ok && ownerInput.trim() !== "" && <p className="form-error" role="alert">{owner.message}</p>}
                  {owner.ok && <p className="muted">Checksum {owner.address}</p>}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="muted">
            BorrowerOperations <code className="tnum">{BORROWER_OPERATIONS}</code> is the same proxy the deploy script checks. It is not a constructor argument.
            Chain and RPC: <a href="https://mezo.org/docs/developers/getting-started/">Mezo getting started</a>.
          </p>
        </section>

        <section className="panel deploy-card">
          <h2>Bytecode and gas</h2>
          <p>Creation bytecode keccak256</p>
          <p><code className="tnum">{CREATION_BYTECODE_HASH}</code></p>
          <p className="muted">solc 0.8.28, optimizer 200 runs, EVM london. This is the artifact in this commit.</p>
          {gas !== null && (
            <p className="tnum">Estimate {gas.toLocaleString("en-US")} gas{cost !== null ? ` · ${formatBtcFromWei(cost)} BTC` : ""}{gasPrice !== null ? ` at ${formatUnits(gasPrice, 9)} gwei` : ""}</p>
          )}
          {estimateNote && <p className="muted">{estimateNote}</p>}
        </section>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="button" className="btn btn-primary btn-block" disabled={!account || !onMainnet || !owner.ok || busy} onClick={() => void deploy()}>
          {busy ? "Waiting for MetaMask…" : "Deploy with MetaMask"}
        </button>

        {txHash && (
          <section className="panel deploy-card">
            <h2>Transaction</h2>
            <p><a href={explorerUrl("tx", txHash)}>{txHash}</a></p>
            {deployed && <p>Deployed address <a href={explorerUrl("address", deployed)}>{deployed}</a></p>}
            {rows && (
              <>
                <p>{matches ? "The reads match the constructor arguments." : "A read does not match. Do not treat this as the live Pocket."}</p>
                <table className="deploy-table">
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.field}>
                        <th>{row.field}</th>
                        <td>{row.match ? "Matches" : "Different"} <code className="tnum">{row.actual}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="muted">pendingOwner {pendingOwner}. earlyFeeBps {feeBps ?? "unknown"} (expected 200).</p>
              </>
            )}
            <p className="muted">facts.json mainnet.pocket stays empty until the source is verified on the explorer.</p>
          </section>
        )}
      </main>
    </div>
  );
}
