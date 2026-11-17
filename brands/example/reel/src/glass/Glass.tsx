// Glass panels: dark and transparent, the size of what they show, with video inside whenever possible.
// `backdrop-filter` doesn't come out in Remotion's render, so the frosting is a copy of the same take, blurred,
// darkened and aligned with the frame behind the panel.
import { Video } from "@remotion/media";
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, GLASS, isVideo, SMOOTH } from "./theme";

/** Footage of the person's own, relative to public/. `from` is the file's frame that plays at frame 0 of the piece. */
export type Footage = { src: string; from?: number };

/**
 * How many frames the current Sequence starts after the footage's frame 0. `ComeFromBehind` sets it, so the frosted
 * copy inside a panel keeps playing in sync with the take behind it.
 */
export const FootageClock = createContext(0);

/** The glass surface alone, for panels over footage that's already blurred (full-screen scenes over `World`). */
export const glassStyle = (darkness = 0.5, radius = 36): CSSProperties => ({
  position: "absolute",
  borderRadius: radius,
  overflow: "hidden",
  background: `linear-gradient(160deg, rgb(255 255 255 / 0.15), rgb(255 255 255 / 0.03) 60%), rgb(${GLASS.tint} / ${darkness})`,
  border: "1.5px solid rgb(255 255 255 / 0.3)",
  boxShadow: "0 30px 70px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(255 255 255 / 0.35)",
});

export type GlassPanelProps = {
  /** Position and size in screen coordinates (1080 × 1920). Size it to what it shows: a big pane with a little piece inside looks empty. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The take behind the panel: its blurred copy is the frosting. Without it, a dark tint. */
  footage?: Footage;
  radius?: number;
  /** 0 to 1: extra dark inside, for panels that carry text over a busy take. */
  darkness?: number;
  /** Blur of the frosting, in px. */
  blur?: number;
  style?: CSSProperties;
  children?: ReactNode;
};

/** A glass panel: frosting from the same take, a soft white gradient, a 1.5 px border, a highlight on top and a large shadow. */
export const GlassPanel = ({ x, y, w, h, footage, radius = 36, darkness = 0, blur = 26, style, children }: GlassPanelProps) => {
  const clock = useContext(FootageClock);
  const { width, height } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: radius,
        overflow: "hidden",
        background: footage ? "#000" : `rgb(${GLASS.tint} / 0.55)`,
        border: "1.5px solid rgb(255 255 255 / 0.32)",
        boxShadow: "0 30px 70px rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.35)",
        ...style,
      }}
    >
      {footage ? (
        <Video
          src={staticFile(footage.src)}
          trimBefore={(footage.from ?? 0) + clock}
          muted
          style={{ position: "absolute", left: -x, top: -y, width, height, objectFit: "cover", filter: `blur(${blur}px) brightness(0.62) saturate(1.25)`, scale: "1.06" }}
        />
      ) : null}
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, rgb(255 255 255 / 0.16), rgb(255 255 255 / 0.04)), rgb(${GLASS.tint} / ${darkness})` }} />
      <div style={{ position: "relative", width: "100%", height: "100%" }}>{children}</div>
    </div>
  );
};

/** 0 → 1 from frame `at` over `frames`, with the identity's smooth curve. */
export const enter = (frame: number, at: number, frames = 10) => interpolate(frame, [at, at + frames], [0, 1], { ...clamp, easing: SMOOTH });

/** The style of something coming in by pulling focus: from blurred and slightly larger to sharp. */
export const focusIn = (frame: number, at: number, frames = 10): CSSProperties => {
  const k = enter(frame, at, frames);
  return { opacity: Math.min(1, k * 3), scale: String(1.06 - 0.06 * k), filter: `blur(${(1 - k) * 14}px)` };
};

/**
 * A glass panel that comes in pulling focus and then gets a slow push-in, as if the camera moved closer.
 * Enter in the pause after the word that names it, never inside the word.
 */
export const GlassWindow = ({ at = 0, push = 0.05, pushFrames = 90, ...panel }: GlassPanelProps & { at?: number; push?: number; pushFrames?: number }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const k = enter(frame, at, 10);
  const p = interpolate(frame, [at, at + pushFrames], [0, 1], clamp);
  return (
    <GlassPanel
      {...panel}
      darkness={panel.darkness ?? 0.55}
      style={{ opacity: Math.min(1, k * 3), scale: String((1.06 - 0.06 * k) * (1 + push * p)), filter: `blur(${(1 - k) * 14}px)`, ...panel.style }}
    />
  );
};

/**
 * One world behind every full-screen scene: the person's own footage (a photo or a timelapse of their desk), very
 * blurred and dark, drifting slower than the camera. Never a background from somewhere else. Without `src`, the
 * brand's dark gradient (only until there's footage).
 */
export const World = ({ src, from = 0, blur = 34, brightness = 0.32 }: { src?: string; from?: number; blur?: number; brightness?: number }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 30;
  const layer: CSSProperties = { position: "absolute", left: -60, top: -60, width: "calc(100% + 120px)", height: "calc(100% + 120px)", objectFit: "cover", filter: `blur(${blur}px) brightness(${brightness}) saturate(0.9)`, translate: `${drift}px 0` };
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 90% at 50% 10%, ${GLASS.world.top} 0%, ${GLASS.world.middle} 45%, ${GLASS.world.bottom} 100%)`, overflow: "hidden" }}>
      {src ? isVideo(src) ? <Video src={staticFile(src)} trimBefore={from} muted style={layer} /> : <Img src={staticFile(src)} style={layer} /> : null}
      <AbsoluteFill style={{ background: "radial-gradient(100% 70% at 50% 45%, transparent 40%, rgb(0 0 0 / 0.6) 100%)" }} />
    </AbsoluteFill>
  );
};
