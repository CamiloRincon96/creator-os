// The «glass» identity's look. Colors and the main font come from the brand (src/brand.ts): change the brand there.
// What belongs to the identity (the display face, the glass tint, the motion curves) is here: change it to make the
// identity yours. What doesn't change is the standard (production/REELS-WORKFLOW.md, «The standard»).
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadDisplay } from "@remotion/google-fonts/Unbounded";
import type { CSSProperties } from "react";
import { Easing } from "remotion";
import { BACKGROUND, C, fontFamily } from "../brand";

export const FONT = {
  /** Captions and small UI: the brand's sans, weight 800, normal letter spacing. */
  sans: fontFamily,
  /**
   * Numbers and big words: a wide, heavy face in uppercase with normal letter spacing, so it hooks and reads at a
   * glance («3 WEEKS», «4–5 HOURS», «$0»). No joined cursive, no serif italic, no negative letterSpacing. Swap it for
   * your identity's own display face (test 3 or 4 over the person's take before choosing).
   */
  display: loadDisplay("normal", { weights: ["700", "800", "900"], subsets: ["latin"] }).fontFamily,
  /** Commands, times and code. */
  mono: loadMono("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily,
};

/** The display face (see FONT.display). */
export const DISPLAY = FONT.display;

/**
 * A big word or number in the display face: weight 800, uppercase, normal letter spacing. Wide type takes more room:
 * keep a big word at 150 px or less and check it fits in 1,080; what doesn't fit is said with a logo or an icon.
 */
export const disp = (size: number, extra?: CSSProperties): CSSProperties => ({
  fontFamily: DISPLAY,
  fontWeight: 800,
  fontSize: size,
  fontStyle: "normal",
  textTransform: "uppercase",
  letterSpacing: 0,
  lineHeight: 1,
  ...extra,
});

/** The identity's colors, taken from the brand. */
export const GLASS = {
  /** What's good, what moves forward, the accent. */
  accent: C.mint,
  /** The word being spoken and the number that carries the weight. */
  highlight: C.warm,
  /** Errors. */
  error: C.coral,
  /** «✓ Done». */
  done: C.mint,
  /** The dark inside the glass, as «r g b» (to use with alpha). */
  tint: BACKGROUND.veil,
  /** The fallback world behind full-screen scenes when there's no footage of the person's own yet. */
  world: BACKGROUND,
};

/** Smooth curve with no bounce: entrances, focus pulls, push-ins. */
export const SMOOTH = Easing.bezier(0.16, 1, 0.3, 1);

/** The spring a piece comes out with (from behind the person, from a gesture). */
export const SPRING_OUT = { damping: 15, mass: 0.7, stiffness: 150 } as const;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** «#9ec5ff» → «rgb(158 197 255 / a)». */
export const rgba = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (x) => x + x) : h, 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${a})`;
};

/** Is this file a video (by its extension)? */
export const isVideo = (src: string) => /\.(mp4|mov|webm|m4v)$/i.test(src);
