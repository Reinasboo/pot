import { coinbaseWallet, injected } from "wagmi/connectors";
import { createConfig, http } from "wagmi";
import { baseSepolia } from "viem/chains";
import { getBuilderDataSuffix } from "@/lib/builder-attribution";

export const supportedChain = baseSepolia;
const builderDataSuffix = getBuilderDataSuffix();

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
  ...(builderDataSuffix ? { dataSuffix: builderDataSuffix } : {}),
  ssr: true,
});
