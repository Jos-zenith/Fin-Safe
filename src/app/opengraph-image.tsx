import { ImageResponse } from "next/og";
import { APP_NAME } from "@/config/brand";

// The picture shown when the link is shared (WhatsApp, LinkedIn, Slack). Drawn at build time; no network, no user data.
export const alt = `${APP_NAME}: see your money clearly, decide with someone accountable`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#171717", color: "#f7f6f0", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", position: "relative", width: 72, height: 72, borderRadius: 22, background: "#c7ff00", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 13, bottom: 13, width: 46, height: 25, background: "#43000b", borderRadius: 4, transform: "skewX(-28deg)" }} />
          </div>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 700, letterSpacing: -1 }}>{APP_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 84, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2 }}>
            <span>See your money&nbsp;</span>
            <span style={{ background: "#c7ff00", color: "#171717", padding: "0 14px", borderRadius: 14 }}>clearly.</span>
            <span>&nbsp;Decide with someone accountable.</span>
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "#a6a6a6" }}>A plain-language plan, checked by a person, with every change recorded.</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#a9a1e8" }}>Demo with synthetic data. Not regulated investment advice.</div>
      </div>
    ),
    size,
  );
}
