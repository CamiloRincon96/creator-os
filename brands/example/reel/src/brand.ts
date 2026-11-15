// The brand in code: colors, font and logo. Swap them for yours (/creator-brand sets them from your design).
import { loadFont } from "@remotion/google-fonts/Figtree";

export const { fontFamily } = loadFont("normal", {
  weights: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

/** Palette: the names are used across the whole kit. deeper/deep/ink are the dark backgrounds; mint is the accent. */
export const C = {
  ink: "#1d2a44",
  deep: "#141d33",
  deeper: "#0b1122",
  noteFrom: "#2f4a8a",
  mint: "#9ec5ff",
  soft: "rgb(255 255 255 / 0.78)",
  warm: "#f2c46d",
  coral: "#f47c6a",
  paper: "#f5f7fb",
};

/** The motion spring: settles without overshooting too much. */
export const SPRING = { damping: 18, mass: 0.9, stiffness: 150 } as const;

/** The horizontal logo in white, for outros on a dark background (relative to public/). */
export const LOGO = "brand/logo-white.svg";

/** The kit's backgrounds (LightBackground, veils and bands): the dark gradient and the lights, as «r g b» to use with alpha. */
export const BACKGROUND = { top: "#22345f", middle: "#141d33", bottom: "#090d18", light: "158 197 255", warm: "242 196 109", veil: "11 17 34" };
