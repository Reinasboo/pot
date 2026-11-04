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
        <p className="connect-disclaimer">
          Never share your recovery phrase. POT will never ask you for it.
        </p>
      </div>
    </main>
  );
}
