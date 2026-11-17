// Few words, and big: one per scene, in the identity's type, and nothing that can't be read in time.
// Text goes below y ≈ 270 so the app's top bar doesn't cover it, and never over the face.
import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { enter, glassStyle } from "./Glass";
import { clamp, FONT, GLASS, SMOOTH } from "./theme";

/** A big serif italic word that comes in by focusing (blur → sharp, rising) and leaves blurring. */
export const BigWord = ({ at, until, y, size = 160, color = "#fff", children }: { at: number; until?: number; y: number; size?: number; color?: string; children: ReactNode }) => {
  const frame = useCurrentFrame();
  if (frame < at - 1 || (until !== undefined && frame > until + 6)) return null;
  const k = interpolate(frame, [at - 1, at + 7], [0, 1], { ...clamp, easing: SMOOTH });
  const out = until === undefined ? 0 : interpolate(frame, [until, until + 6], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        textAlign: "center",
        fontFamily: FONT.serif,
        fontStyle: "italic",
        fontSize: size,
        color,
        lineHeight: 1,
        letterSpacing: -1,
        opacity: k * (1 - out),
        translate: `0 ${(1 - k) * 36}px`,
        filter: `blur(${(1 - k) * 12 + out * 8}px)`,
        textShadow: "0 8px 36px rgb(0 0 0 / 0.75)",
      }}
    >
      {children}
    </div>
  );
};

/**
 * A number and its word («4–5 *hours*»): the number in the brand's sans 800, the word in the serif.
 * With `count`, the number climbs to `value` between those two frames. It counts with Math.floor(frame): inside
 * CameraMotionBlur the samples are drawn ahead, and two numbers on screen at once must say the same thing.
 */
export const NumberWord = ({ value, word, at = 0, y, size = 170, count, strong }: { value: number | string; word: string; at?: number; y: number; size?: number; count?: [number, number]; strong?: boolean }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const k = enter(frame, at, 9);
  const n = count && typeof value === "number" ? Math.round(interpolate(Math.floor(frame), count, [0, value], clamp)) : value;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", alignItems: "baseline", gap: size * 0.12, opacity: k, translate: `0 ${(1 - k) * 34}px`, filter: `blur(${(1 - k) * 14}px)` }}>
      <span style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: size, lineHeight: 0.9, letterSpacing: size * -0.05, color: strong ? GLASS.highlight : "#fff", fontVariantNumeric: "tabular-nums", textShadow: "0 10px 28px rgb(0 0 0 / 0.45)" }}>{n}</span>
      <span style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: size * 0.6, lineHeight: 0.9, color: strong ? GLASS.highlight : "rgb(255 255 255 / 0.88)", textShadow: "0 10px 28px rgb(0 0 0 / 0.45)" }}>{word}</span>
    </div>
  );
};

/** One word in glass under the chin (y ≈ 1,175): it reads in full and doesn't cover the face. */
export const GlassPill = ({ at, until, text, top = 1175, size = 120 }: { at: number; until?: number; text: string; top?: number; size?: number }) => {
  const frame = useCurrentFrame();
  if (frame < at - 1 || (until !== undefined && frame > until + 5)) return null;
  const g = enter(frame, at, 8);
  const out = until === undefined ? 0 : interpolate(frame, [until, until + 5], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", justifyContent: "center", opacity: g * (1 - out) }}>
      <div style={{ ...glassStyle(0.5, 999), position: "relative", padding: `${size * 0.08}px ${size * 0.43}px ${size * 0.2}px`, scale: String(1.25 - 0.25 * g), filter: `blur(${(1 - g) * 10 + out * 8}px)` }}>
        <span style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: size, color: "#fff", lineHeight: 1 }}>{text}</span>
      </div>
    </div>
  );
};

/** A word of the cut map (voice/cut-vN.json, `phrases[].words`): text and seconds. */
export type CaptionWord = { t: string; start: number; end: number };

/**
 * Captions of 1 to 3 words, the spoken one in the highlight color. A group never crosses the end of a sentence or
 * the start of a phrase of the cut map (so «…the last one.» and «And the best part» never share a caption).
 * Under the chin (y ≈ 1,180) while the person is on camera, lower (y ≈ 1,400) on full-screen scenes. Hide them with
 * `hide` where the phrase is already written big on screen.
 */
export const GlassCaptions = ({
  words,
  phrases = [],
  top = 1180,
  offset = 0,
  hide = [],
  after = -1,
}: {
  words: CaptionWord[];
  /** The cut map's phrases: only their `start` is used. */
  phrases?: { start: number }[];
  top?: number;
  /** Seconds of the voice at frame 0 of this Sequence. */
  offset?: number;
  /** [from, to] seconds without captions. */
  hide?: [number, number][];
  /** No captions for words before this second. */
  after?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = offset + frame / fps;
  if (hide.some(([a, b]) => t >= a && t < b)) return null;
  const W = words;
  const startsPhrase = (k: number) => phrases.some((p) => Math.abs(W[k].start - p.start) < 0.08);
  const i = W.findIndex((p, k) => t >= p.start - 0.04 && t < Math.min(W[k + 1]?.start ?? p.end + 0.4, p.end + 0.5));
  if (i < 0 || W[i].start < after) return null;
  let a = i;
  while (a > 0 && i - a < 2 && !/[.,?!]$/.test(W[a - 1].t) && !startsPhrase(a) && W[a - 1].start >= after) a--;
  let b = a;
  while (b < W.length - 1 && b - a < 2 && !/[.,?!]$/.test(W[b].t) && !startsPhrase(b + 1)) b++;
  return (
    <AbsoluteFill style={{ top, height: 150, justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
      <div style={{ display: "flex", gap: 22, alignItems: "center", fontFamily: FONT.sans, fontWeight: 800, fontSize: 74, letterSpacing: -2 }}>
        {W.slice(a, b + 1).map((p, k) => (
          <span key={k} style={{ color: a + k === i ? GLASS.highlight : "#fff", scale: a + k === i ? "1.06" : "1", textShadow: "0 5px 20px rgb(0 0 0 / 0.7), 0 2px 4px rgb(0 0 0 / 0.8)" }}>
            {p.t.replace(/[.,]$/, "")}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
