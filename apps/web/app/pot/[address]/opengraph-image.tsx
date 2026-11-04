import { ImageResponse } from "next/og";
import { formatTokenAmount, getPublicPot } from "@/lib/public-pot";

export const alt = "POT shared group fund";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const pot = await getPublicPot(address);
  if (!pot.isPublic) throw new Error("This pot is not public.");
  const amount = formatTokenAmount(pot.totalContributed, pot.tokenDecimals);

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "#10271b",
          color: "#f4f5ef",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Arial, sans-serif",
          height: "100%",
          justifyContent: "space-between",
          padding: "64px 76px",
          width: "100%",
        }}
      >
        <div style={{ color: "#8fe0aa", fontSize: 24, fontWeight: 700, letterSpacing: 7 }}>
          POT · BASE SEPOLIA
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ color: "#c5d1c6", fontSize: 28 }}>A group fund with clear money rules</div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.08, maxWidth: 1000 }}>
            {pot.name.slice(0, 70)}
          </div>
          <div style={{ color: "#8fe0aa", fontSize: 48, fontWeight: 700 }}>
            {amount} {pot.tokenSymbol} contributed
          </div>
          {pot.description && (
            <div style={{ color: "#c5d1c6", fontSize: 24, maxWidth: 950 }}>
              {pot.description.slice(0, 120)}
            </div>
          )}
        </div>
        <div style={{ color: "#c5d1c6", fontSize: 20 }}>
          Preview the plan and verify the rules before taking part · potonbase.vercel.app
        </div>
      </div>
    ),
    size,
  );
}
