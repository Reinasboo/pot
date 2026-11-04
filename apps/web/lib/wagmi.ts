import { coinbaseWallet, injected } from "wagmi/connectors";
import { createConfig, http } from "wagmi";
import { baseSepolia } from "viem/chains";

export const supportedChain = baseSepolia;

export const wagmiConfig = createConfig({
  chains: [supportedChain],
  connectors: [
    coinbaseWallet({
      appName: "POT",
    }),
    injected(),
  ],
  transports: {
    [supportedChain.id]: http(),
  },
  ssr: true,
});
