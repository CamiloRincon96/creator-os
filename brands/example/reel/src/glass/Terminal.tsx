// A terminal in glass, for the real command (big, in one or two lines) and the real output it prints.
// Never a made-up command: copy it from the README or from what you ran.
import type { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { GlassWindow, type Footage } from "./Glass";
import { clamp, FONT, GLASS } from "./theme";

export const Terminal = ({ at = 0, x = 50, y = 560, w = 980, h = 520, footage, children }: { at?: number; x?: number; y?: number; w?: number; h?: number; footage?: Footage; children: ReactNode }) => (
  <GlassWindow at={at} x={x} y={y} w={w} h={h} footage={footage} darkness={0.72} radius={28} push={0.03}>
    <div style={{ position: "absolute", left: 22, top: 18, display: "flex", gap: 10 }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <div key={c} style={{ width: 15, height: 15, borderRadius: 8, background: c, opacity: 0.85 }} />
      ))}
    </div>
    <div style={{ position: "absolute", left: 40, right: 40, top: 66, fontFamily: FONT.mono, fontSize: 40, lineHeight: 1.5, color: "#fff" }}>{children}</div>
  </GlassWindow>
);

/**
 * Types `text` between frames `from` and `to`, with a blinking cursor until it's done. A «\n» breaks the line:
 * a long command reads better big and in two lines than small in one.
 */
export const Typed = ({ text, from, to, size = 60, prompt = "› " }: { text: string; from: number; to: number; size?: number; prompt?: string }) => {
  const frame = useCurrentFrame();
  const n = Math.floor(interpolate(frame, [from, to], [0, text.length], clamp));
  const typing = frame < to + 4;
  return (
    <div style={{ fontSize: size, lineHeight: 1.3, whiteSpace: "pre-wrap" }}>
      <span style={{ color: GLASS.accent }}>{prompt}</span>
      {text.slice(0, n)}
      {typing ? <span style={{ display: "inline-block", width: size * 0.5, height: size * 1.05, marginLeft: 6, background: "#fff", verticalAlign: -size * 0.16, opacity: Math.floor(frame / 8) % 2 ? 1 : 0.15 }} /> : null}
    </div>
  );
};

/** The lines a real check printed, one every `every` frames, each with its ✓. */
export const CheckLines = ({ lines, from, every = 3, size = 54 }: { lines: string[]; from: number; every?: number; size?: number }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {lines.map((t, i) => (
        <div key={t} style={{ opacity: frame >= from + i * every ? 1 : 0, whiteSpace: "nowrap", fontSize: size, lineHeight: 1.45 }}>
          <span style={{ color: GLASS.done }}>✓ </span>
          {t}
        </div>
      ))}
    </>
  );
};
