"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { supportedChain } from "@/lib/wagmi";

function describeWalletError(error: Error | null): string | null {
  if (!error) return null;

  const message = error.message.toLowerCase();
  if (message.includes("reject") || message.includes("denied") || message.includes("4001")) {
    return "The wallet request was declined. You can try again whenever you are ready.";
  }

  return "Could not connect to that wallet. Make sure it is unlocked, then try again.";
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletConnection() {
  const { address, chainId, connector, isConnected } = useAccount();
  const {
    connect,
    connectors,
    error: connectError,
    isPending: isConnecting,
    reset: resetConnect,
  } = useConnect();
  const {
    disconnect,
    error: disconnectError,
    isPending: isDisconnecting,
  } = useDisconnect();
  const {
    error: switchError,
    isPending: isSwitching,
    reset: resetSwitch,
    switchChain,
  } = useSwitchChain();

  const wrongNetwork = isConnected && chainId !== supportedChain.id;
  const errorMessage =
    describeWalletError(connectError) ??
    describeWalletError(switchError) ??
    describeWalletError(disconnectError);

  if (isConnected && address) {
    return (
      <section className="wallet-panel" aria-labelledby="wallet-connected-title">
        <div className="wallet-panel-top">
          <span className="wallet-state-dot" />
          <p className="wallet-kicker">WALLET CONNECTED</p>
        </div>
        <h2 id="wallet-connected-title">Wallet connected.</h2>
        <p className="wallet-panel-description">
          POT can see your public address and use it to look up public pots. Connecting does not
          let POT spend or move your money.
        </p>
        <dl className="wallet-details">
          <div>
            <dt>Address</dt>
            <dd title={address}>{shortenAddress(address)}</dd>
          </div>
          <div>
            <dt>Wallet app</dt>
            <dd>{connector?.name ?? "Connected wallet"}</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd className={wrongNetwork ? "wallet-network-warning" : ""}>
              {wrongNetwork ? `Not on ${supportedChain.name}` : supportedChain.name}
            </dd>
          </div>
        </dl>
        {wrongNetwork && (
          <button
            className="wallet-action wallet-action-primary"
            disabled={isSwitching}
            onClick={() => {
              resetSwitch();
              switchChain({ chainId: supportedChain.id });
            }}
            type="button"
          >
            {isSwitching ? "Switching network…" : `Switch to ${supportedChain.name}`}
          </button>
        )}
        {!wrongNetwork && (
          <>
            <p className="wallet-network-ready">
              <span /> Ready to view pots on the test network
            </p>
            <Link className="wallet-action wallet-action-primary wallet-dashboard-link" href="/dashboard">
              See pots linked to this wallet
            </Link>
          </>
        )}
        <button
          className="wallet-action wallet-action-secondary"
          disabled={isDisconnecting}
          onClick={() => disconnect()}
          type="button"
        >
          {isDisconnecting ? "Disconnecting…" : "Disconnect wallet"}
        </button>
        {errorMessage && (
          <p className="wallet-error" role="alert">
            {errorMessage}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="wallet-panel" aria-labelledby="wallet-connect-title">
      <div className="wallet-panel-top">
        <span className="wallet-state-dot" />
        <p className="wallet-kicker">WALLET ONBOARDING</p>
      </div>
      <h2 id="wallet-connect-title">Choose your wallet.</h2>
      <p className="wallet-panel-description">
        Choose your wallet app to continue. This lets POT read your public address; it does not
        approve a payment or give POT permission to move money.
      </p>
      <div className="wallet-options">
        {connectors.map((walletConnector) => (
          <button
            className="wallet-action wallet-option"
            disabled={isConnecting}
            key={walletConnector.uid}
            onClick={() => {
              resetConnect();
              connect({ connector: walletConnector });
            }}
            type="button"
          >
            <span>{walletConnector.name}</span>
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </div>
      {isConnecting && <p className="wallet-pending" role="status">Approve the connection in your wallet…</p>}
      {errorMessage && (
        <p className="wallet-error" role="alert">
          {errorMessage}
        </p>
      )}
      <div className="wallet-network-note">
        <span className="wallet-network-icon">◎</span>
        <p>
          <strong>Base Sepolia test network</strong>
          <br />
          Test network · test tokens have no real-world value
        </p>
      </div>
    </section>
  );
}
