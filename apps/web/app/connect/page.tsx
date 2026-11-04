import Link from "next/link";
import { WalletConnection } from "@/components/wallet-connection";

export const metadata = {
  title: "Connect wallet",
  description: "Connect a wallet to see public pots on Base Sepolia. Payments are not available yet.",
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
          <h1>Connect a wallet to see your pots.</h1>
          <p>
            Connecting shows the public pots linked to your wallet. It does not give POT access to
            your funds or approve a payment. This site is set up for Base Sepolia testnet; pot
            creation and payments are not available yet.
          </p>
        </div>
        <WalletConnection />
        <section className="connect-testnet-note" aria-labelledby="test-wallet-title">
          <h2 id="test-wallet-title">This is a test network</h2>
          <p>
            Base Sepolia uses test ETH for transaction fees and test USDC. These tokens have no
            mainnet value. Do not use a wallet that holds real assets. Live pot transactions are
            currently disabled.
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
