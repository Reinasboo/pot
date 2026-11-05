import { ImageResponse } from "next/og";
import { SocialCard } from "@/components/social-card";
import { getSiteUrl } from "@/lib/site-metadata";
import { socialImageOptions } from "@/lib/social-image";

export const alt = "POT — Big plans. One shared pot.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    <SocialCard host={getSiteUrl().hostname} />,
    await socialImageOptions(),
  );
}
