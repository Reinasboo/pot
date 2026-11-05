export function SocialCard({
  title,
  description,
  amount,
  host,
}: {
  title?: string;
  description?: string;
  amount?: string;
  host: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#f7f7f0",
        color: "#141b19",
        fontFamily: "Geist",
        fontWeight: 500,
        width: "100%",
        height: "100%",
        padding: "56px 64px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <svg width="180" height="60" viewBox="0 0 120 40" fill="none">
          <g fill="#141b19">
            <circle cx="12" cy="10" r="3" />
            <circle cx="20" cy="6" r="3" />
            <circle cx="28" cy="10" r="3" />
          </g>
          <path
            d="M6 19h28l-2 9a12.3 12.3 0 0 1-24 0l-2-9Z"
            stroke="#141b19"
            strokeWidth="3"
          />
          <path
            d="M49 31V9h9a7 7 0 0 1 0 14h-9M99 9h18m-9 0v22"
            stroke="#141b19"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <rect
            x="74"
            y="9"
            width="15"
            height="22"
            rx="7.5"
            stroke="#141b19"
            strokeWidth="5.5"
          />
        </svg>
        <span style={{ fontSize: 24, color: "#60695f" }}>
          Good things, pooled.
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {title ? (
          <div
            style={{
              fontSize: 64,
              lineHeight: 1.08,
              letterSpacing: -2,
              maxWidth: 1000,
              overflow: "hidden",
              maxHeight: 150,
            }}
          >
            {title}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 88,
              lineHeight: 1,
              letterSpacing: -4,
            }}
          >
            <span>Big plans.</span>
            <span>One shared pot.</span>
          </div>
        )}
        <div
          style={{
            fontSize: 26,
            lineHeight: 1.3,
            color: "#60695f",
            maxWidth: 960,
          }}
        >
          {description || "The trip. The gift. The idea everyone’s in on."}
        </div>
        {amount && (
          <div style={{ display: "flex", fontSize: 30, color: "#17653a" }}>
            {amount}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 20,
        }}
      >
        <span style={{ color: "#60695f" }}>{host}</span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            background: "#b7f36b",
            padding: "16px 24px",
            borderRadius: 8,
          }}
        >
          Shared goals. Clear money rules.
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18 18 6M6 6h12v12" stroke="#141b19" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </div>
    </div>
  );
}
