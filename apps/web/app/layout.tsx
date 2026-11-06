import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/geist";
import { Providers } from "./providers";
import "./globals.css";
import "./home.css";
import {
  brandDescription,
  brandTitle,
  getSiteUrl,
  pageMetadata,
} from "@/lib/site-metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    title: brandTitle,
    description: brandDescription,
    path: "/",
  }),
  metadataBase: getSiteUrl(),
  title: {
    default: "POT — Good things, pooled.",
    template: "%s | POT",
  },
  description:
    "Plan a shared gift, trip, or fundraiser with clear money rules. Preview and share your plan without a wallet. Payments require testnet deployment.",
  applicationName: "POT",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
