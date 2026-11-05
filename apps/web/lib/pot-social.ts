import "server-only";
import { getPublicPot } from "./public-pot";
import { pageMetadata } from "./site-metadata";

/** Social crawlers never receive a private-link access key. */
export async function getPotSocialPreview(address: string) {
  try {
    const pot = await getPublicPot(address);
    return pot.isPublic ? pot : null;
  } catch {
    // Unconfigured services, missing pots, and private pots all receive the same generic card.
    return null;
  }
}

export async function getPotPageMetadata(address: string) {
  const pot = await getPotSocialPreview(address);
  const path = `/pot/${encodeURIComponent(address)}`;
  return pageMetadata({
    title: pot?.name ?? "A shared pot",
    description: pot?.description
      ? Array.from(pot.description).slice(0, 180).join("")
      : "A shared pot for a shared goal. Open the link to review the money rules. Good things, pooled.",
    path,
    imagePath: `${path}/opengraph-image`,
    index: pot?.isPublic ?? false,
  });
}
