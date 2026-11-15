// YOUR product's screens inside the Explainer's phone («app» scene). Swap them for screenshots or
// components of your app. These are generic: a big balance, a list of transactions and «log it by talking».
import { interpolate, spring, useCurrentFrame } from "remotion";
import { C, fontFamily, SPRING } from "../brand";
import type { Scene } from "./Explainer";

const FPS = 30;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const springAt = (frame: number, from: number) => (frame < from ? 0 : spring({ frame: frame - from, fps: FPS, config: SPRING }));
const formatNumber = (n: number) => Math.round(n).toLocaleString("en-US");

export const AppScreen = ({ e }: { e: Extract<Scene, { type: "app" }> }) => {
  const frame = useCurrentFrame();
  if (e.screen === "balance") {
    const r = springAt(frame, 2);
    return (
      <div style={{ padding: "90px 24px", fontFamily, background: C.deeper, height: "100%" }}>
        <div style={{ borderRadius: 26, padding: "34px 26px", background: `linear-gradient(140deg, ${C.noteFrom}, ${C.ink})`, color: "#fff", opacity: r, scale: String(0.92 + 0.08 * r) }}>
          <div style={{ fontSize: 18, fontWeight: 700, opacity: 0.8 }}>Available today</div>
          <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 8, fontVariantNumeric: "tabular-nums" }}>
            ${formatNumber((e.amount ?? 47741) * interpolate(frame, [6, 30], [0, 1], clamp))}
          </div>
        </div>
      </div>
    );
  }
  if (e.screen === "transactions") {
    const items = e.items ?? [["Lunch", "-$18.00"], ["Transport", "-$12.00"], ["Groceries", "-$85.00"]];
    return (
      <div style={{ padding: "56px 22px", fontFamily, background: C.paper, height: "100%" }}>
        <div style={{ fontWeight: 800, fontSize: 30, color: C.deeper, marginBottom: 18 }}>Transactions</div>
        {items.map(([a, b], i) => {
          const r = springAt(frame, 6 + i * 6);
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "16px 14px", marginBottom: 10, borderRadius: 16, background: "#fff", boxShadow: "0 6px 16px rgb(0 0 0 / 0.06)", opacity: r, translate: `0px ${(1 - r) * 20}px`, fontSize: 20 }}>
              <span style={{ fontWeight: 700, color: C.deeper }}>{a}</span>
              <span style={{ fontWeight: 800, color: "#c2412f", fontVariantNumeric: "tabular-nums" }}>{b}</span>
            </div>
          );
        })}
      </div>
    );
  }
  const r1 = springAt(frame, 4);
  const r2 = springAt(frame, 26);
  return (
    <div style={{ padding: "70px 22px", fontFamily, background: C.paper, height: "100%" }}>
      <div style={{ fontWeight: 800, fontSize: 30, color: C.deeper, marginBottom: 26 }}>Log</div>
      <div style={{ marginLeft: "auto", width: "84%", padding: "16px 18px", borderRadius: "20px 20px 6px 20px", background: C.noteFrom, color: "#fff", fontSize: 21, fontWeight: 600, opacity: r1, scale: String(0.9 + 0.1 * r1) }}>
        “{e.said ?? "lunch, 18 dollars, cash"}”
      </div>
      <div style={{ marginTop: 26, padding: "18px 16px", borderRadius: 18, background: "#fff", boxShadow: "0 8px 22px rgb(0 0 0 / 0.08)", opacity: r2, translate: `0px ${(1 - r2) * 24}px` }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#5f6b80", letterSpacing: "0.06em" }}>DONE</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.deeper, marginTop: 4 }}>{e.category ?? "Food · Automatic"}</div>
      </div>
    </div>
  );
};
