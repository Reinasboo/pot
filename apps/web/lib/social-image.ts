import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function socialImageOptions() {
  const font = await readFile(
    path.join(process.cwd(), "public/brand/geist-medium.ttf"),
  );
  return {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: "Geist",
        data: font,
        weight: 500 as const,
        style: "normal" as const,
      },
    ],
  };
}
