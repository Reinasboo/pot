import type { Metadata } from "next";

export const brandTitle = "Big plans. One shared pot.";
export const brandDescription =
  "The trip. The gift. The idea everyone’s in on. Plan a shared pot with a clear goal and money rules everyone understands. Good things, pooled.";

export function getSiteUrl(): URL {
  const url = new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://potonbase.vercel.app",
  );
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be a public HTTPS URL without credentials.",
    );
  }
  return new URL(url.origin);
}

export function pageMetadata({
  title,
  description,
  path,
  imagePath = "/opengraph-image",
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  imagePath?: string;
  index?: boolean;
}): Metadata {
  const url = new URL(path, getSiteUrl()).toString();
  const image = new URL(imagePath, getSiteUrl()).toString();
  const socialTitle = `${title} | POT`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index, follow: true },
    openGraph: {
      type: "website",
      siteName: "POT",
      locale: "en_US",
      title: socialTitle,
      description,
      url,
      images: [
        {
          url: image,
          secureUrl: image,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [{ url: image, alt: title }],
    },
  };
}
