// Kit for the «scenes and cameos» style, version 1: the base the creator approved on 13 Nov 2026 with «Sin anotar»
// (a Spanish-language piece: «keep roughly this style for now… it isn't that visually appealing yet»). See
// production/styles/scenes-and-cameos/STYLE.md. A background with light and depth, objects with volume that float
// in 3D, shines that sweep across the glass. No line patterns and no flat cards in a row.
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { BACKGROUND, C, fontFamily, SPRING } from "../brand";

const FPS = 30;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ENTER = Easing.bezier(0.2, 0.8, 0.2, 1);
const EXIT = Easing.bezier(0.4, 0, 1, 1);

/** 0 to 1 with the brand's spring (ADR-0035) from frame `from`. */
export const springK = (frame: number, from: number) => (frame < from ? 0 : spring({ frame: frame - from, fps: FPS, config: SPRING }));

/** Scene background with depth: dark, a soft light behind the subject, a warm one and a vignette. */
export const LightBackground = ({ cx = 50, cy = 50, warm = 0.07 }: { cx?: number; cy?: number; warm?: number }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 40) * 3;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 90% at 50% 10%, ${BACKGROUND.top} 0%, ${BACKGROUND.middle} 45%, ${BACKGROUND.bottom} 100%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(42% 26% at ${cx + drift}% ${cy}%, rgb(${BACKGROUND.light} / 0.22) 0%, rgb(${BACKGROUND.light} / 0) 100%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(30% 18% at ${cx - 18 - drift}% ${cy + 22}%, rgb(${BACKGROUND.warm} / ${warm}) 0%, rgb(${BACKGROUND.warm} / 0) 100%)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(90% 70% at 50% 50%, rgb(0 0 0 / 0) 55%, rgb(0 0 0 / 0.5) 100%)" }} />
    </AbsoluteFill>
  );
};

/** At the bottom, whatever floats fades into the dark: the captions go there (y = 1,330 and below). */
export const DarkFloor = ({ from = 1120, to = 1330 }: { from?: number; to?: number }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: from,
      bottom: 0,
      background: `linear-gradient(180deg, rgb(3 19 13 / 0) 0px, rgb(3 19 13 / 0.92) ${to - from}px, rgb(3 19 13 / 0.96) 100%)`,
    }}
  />
);

/** A shine that sweeps across a surface once, from frame `at`. Goes inside something with `overflow: hidden`. */
export const Shine = ({ at, duration = 20, strength = 0.22 }: { at: number; duration?: number; strength?: number }) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + duration) return null;
  const p = interpolate(frame, [at, at + duration], [-0.3, 1.3], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: "inherit" }}>
      <div
        style={{
          position: "absolute",
          top: "-60%",
          bottom: "-60%",
          left: `${p * 100}%`,
          width: "32%",
          translate: "-50% 0",
          rotate: "20deg",
          background: `linear-gradient(90deg, rgb(255 255 255 / 0) 0%, rgb(255 255 255 / ${strength}) 50%, rgb(255 255 255 / 0) 100%)`,
        }}
      />
    </div>
  );
};

/** A shadow on the «floor» under something that floats: gives it height. */
export const FloorShadow = ({ cx = 540, y, width, strength = 1 }: { cx?: number; y: number; width: number; strength?: number }) => (
  <div style={{ position: "absolute", left: cx - width / 2, top: y, width, height: Math.max(60, width * 0.11), borderRadius: "50%", background: "rgb(0 0 0 / 0.5)", filter: "blur(40px)", opacity: strength }} />
);

/**
 * A plane that floats in 3D: it comes in rising and tilted, straightens slowly over `duration` frames and sways
 * slightly. Everything inside moves with it, in screen coordinates (1080 × 1920).
 */
export const Float = ({
  enter,
  duration,
  tiltX = [22, 8],
  tiltY = [-14, -4],
  origin = "50% 50%",
  sway = 6,
  children,
}: {
  enter: number;
  duration: number;
  tiltX?: [number, number];
  tiltY?: [number, number];
  origin?: string;
  sway?: number;
  children: ReactNode;
}) => {
  const frame = useCurrentFrame();
  const r = springK(frame, enter);
  const t = frame - enter;
  const gx = interpolate(t, [0, duration], tiltX, clamp) * (0.4 + 0.6 * r);
  const gy = interpolate(t, [0, duration], tiltY, clamp);
  return (
    <AbsoluteFill style={{ perspective: 1800 }}>
      <AbsoluteFill
        style={{
          transform: `translateY(${(1 - r) * 140 + Math.sin(frame / 22) * sway}px) rotateX(${gx}deg) rotateY(${gy}deg)`,
          transformOrigin: origin,
          opacity: interpolate(t, [0, 6], [0, 1], clamp),
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A glass card: translucent white, mint border and a long shadow. */
export const Glass = ({ style, children, shine }: { style: CSSProperties; children?: ReactNode; shine?: number }) => (
  <div
    style={{
      position: "absolute",
      borderRadius: 52,
      background: "linear-gradient(160deg, rgb(255 255 255 / 0.13) 0%, rgb(255 255 255 / 0.05) 60%)",
      border: "2px solid rgb(182 242 201 / 0.28)",
      boxShadow: "0 50px 120px rgb(0 0 0 / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.25)",
      overflow: "hidden",
      fontFamily,
      ...style,
    }}
  >
    {children}
    {shine !== undefined ? <Shine at={shine} /> : null}
  </div>
);

/** The app screen is 390 × 844: whatever goes inside the phone is drawn at that size. */
export const SCREEN = { width: 390, height: 844 };

/** A phone with the app screen scaled up to `width`, centered on `cx`. Soft reflection and optional shine. */
export const Phone = ({ width, top, cx = 540, shine, children }: { width: number; top: number; cx?: number; shine?: number; children: ReactNode }) => {
  const k = width / SCREEN.width;
  return (
    <div
      style={{
        position: "absolute",
        left: cx - width / 2 - 14,
        top,
        padding: 14,
        borderRadius: 40 * k + 14,
        background: "linear-gradient(160deg, #26332d 0%, #080d0b 60%)",
        boxShadow: "0 0 0 2px rgb(255 255 255 / 0.12), 0 70px 140px -30px rgb(0 0 0 / 0.8), 0 30px 60px -20px rgb(0 0 0 / 0.6)",
      }}
    >
      <div style={{ position: "relative", width, height: SCREEN.height * k, borderRadius: 40 * k, overflow: "hidden", background: C.paper }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: SCREEN.width, height: SCREEN.height, transformOrigin: "0 0", scale: String(k) }}>{children}</div>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(125deg, rgb(255 255 255 / 0.12) 0%, rgb(255 255 255 / 0) 32%)", pointerEvents: "none" }} />
        {shine !== undefined ? <Shine at={shine} strength={0.3} /> : null}
      </div>
    </div>
  );
};

/** Scene title, at the top: a small line in mint (optional) and the big phrase. Comes in rising 14 px. */
export const SceneTitle = ({
  kicker,
  children,
  enter,
  exit,
  top = 300,
  size = 100,
}: {
  kicker?: string;
  children: ReactNode;
  enter: number;
  exit?: number;
  top?: number;
  size?: number;
}) => {
  const frame = useCurrentFrame();
  const out = exit === undefined ? 0 : interpolate(frame, [exit, exit + 5], [0, 1], { ...clamp, easing: EXIT });
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        top,
        fontFamily,
        opacity: interpolate(frame, [enter, enter + 7], [0, 1], clamp) * (1 - out),
        translate: `0px ${interpolate(frame, [enter, enter + 9], [14, 0], { ...clamp, easing: ENTER }) - 18 * out}px`,
      }}
    >
      {kicker ? <div style={{ color: C.mint, fontWeight: 700, fontSize: 34, letterSpacing: "0.22em", marginBottom: 10 }}>{kicker}</div> : null}
      <div style={{ color: "#fff", fontWeight: 800, fontSize: size, letterSpacing: "-0.03em", lineHeight: 1.04 }}>{children}</div>
    </div>
  );
};

/** Voice waves: bars that move while someone talks. */
export const Waves = ({ n = 5, height = 40, color = C.deep, width = 7 }: { n?: number; height?: number; color?: string; width?: number }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: width * 0.8, height }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ width, borderRadius: width, background: color, height: height * (0.3 + 0.7 * Math.abs(Math.sin(frame / 3.2 + i * 1.3))) }} />
      ))}
    </div>
  );
};
