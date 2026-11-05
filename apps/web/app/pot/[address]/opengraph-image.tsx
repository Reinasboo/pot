import { ImageResponse } from "next/og";
import { SocialCard } from "@/components/social-card";
import { getPotSocialPreview } from "@/lib/pot-social";
import { getSiteUrl } from "@/lib/site-metadata";
import { formatDisplayAmount } from "@/lib/format-amount";
import { socialImageOptions } from "@/lib/social-image";

export const alt = "POT — Good things, pooled.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const pot = await getPotSocialPreview((await params).address);
  return new ImageResponse(
    <SocialCard
      host={getSiteUrl().hostname}
      title={pot ? Array.from(pot.name).slice(0, 70).join("") : undefined}
      description={
        pot?.description
          ? Array.from(pot.description).slice(0, 120).join("")
          : undefined
      }
      amount={
        pot
          ? `${formatDisplayAmount(pot.totalContributed, pot.tokenDecimals, pot.tokenSymbol)} contributed · Base Sepolia testnet`
          : undefined
      }
    />,
    await socialImageOptions(),
  );
}
