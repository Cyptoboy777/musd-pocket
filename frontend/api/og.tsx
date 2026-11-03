import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

/** Dynamic OG image for invite links: /api/og?invite=N&name=...&saved=...&target=... */
export default function handler(req: Request) {
  const url = new URL(req.url);
  const invite = url.searchParams.get("invite") || "?";
  const name = (url.searchParams.get("name") || "MUSD Pocket goal").slice(0, 48);
  const saved = url.searchParams.get("saved") || "0";
  const target = url.searchParams.get("target") || "0";
  const pctRaw = Number(url.searchParams.get("pct") || "0");
  const pct = Number.isFinite(pctRaw) ? Math.max(0, Math.min(100, pctRaw)) : 0;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(145deg, #06130f 0%, #0c1d17 55%, #142820 100%)",
          color: "#f4efe4",
          padding: "56px 64px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#E6C27A", fontSize: 22, letterSpacing: 2 }}>MUSD POCKET</span>
            <span style={{ color: "#9bb3a8", fontSize: 18, marginTop: 8 }}>Mezo testnet · invite #{invite}</span>
          </div>
          <div
            style={{
              border: "1px solid rgba(230,194,122,0.35)",
              borderRadius: 999,
              padding: "10px 18px",
              color: "#E6C27A",
              fontSize: 18,
            }}
          >
            Chip in
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: -1 }}>{name}</div>
          <div style={{ fontSize: 28, color: "#c9d7d0" }}>
            {saved} of {target} MUSD
          </div>
          <div
            style={{
              width: "100%",
              height: 16,
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
              display: "flex",
            }}
          >
            <div style={{ width: `${pct}%`, height: "100%", background: "#E6C27A" }} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", color: "#9bb3a8", fontSize: 20 }}>
          <span>Bitcoin-backed savings goals</span>
          <span>musd-pocket-mezo.vercel.app</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
