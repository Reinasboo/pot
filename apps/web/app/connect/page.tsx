import Link from "next/link";
import { WalletConnection } from "@/components/wallet-connection";

export const metadata = {
  title: "Connect wallet",
  description: "Connect a compatible wallet to POT on Base Sepolia.",
};

export default function ConnectPage() {
  return (
    <main className="connect-page">
      <header className="connect-header">
        <Link className="brand" href="/" aria-label="POT home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>POT</span>
        </Link>
        <Link className="connect-back-link" href="/">
          Back to home
        </Link>
      </header>
      <div className="connect-content">
        <div className="connect-intro">
          <p className="eyebrow"><span className="status-dot" /> Wallet setup</p>
          <h1>A clear first step.</h1>
          <p>
            Connect a compatible wallet to see how POT onboarding works. This prototype is
            configured for Base Sepolia and does not yet create pots or handle payments.
          </p>
        </div>
        <WalletConnection />
        <section className="connect-testnet-note" aria-labelledby="test-wallet-title">
          <h2 id="test-wallet-title">Preparing two-wallet tests?</h2>
          <p>
            Use two dedicated Base Sepolia accounts in separate browser profiles. Fund each with
            test ETH for gas and test USDC. POT does not ask for recovery phrases or private keys,
            and live pot transactions are not enabled yet.
          </p>
          <p>
            <a href="https://portal.cdp.coinbase.com/products/faucet">Base Sepolia ETH faucet</a>
            {" · "}
            <a href="https://faucet.circle.com/">Circle USDC testnet faucet</a>
          </p>
        </section>
        <p className="connect-disclaimer">
          Never share your recovery phrase. POT will never ask you for it.
        </p>
      </div>
    </main>
  );
}
