import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/dm-sans";
import "@fontsource/dm-serif-display";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "POT — Money moves better together",
    template: "%s | POT",
  },
  description:
    "POT is a shared space for groups to coordinate contributions, track progress, and reach goals together.",
  applicationName: "POT",
  openGraph: {
    title: "POT — Money moves better together",
    description:
      "Create a pot, bring your people together, and reach shared goals with transparent contributions.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
