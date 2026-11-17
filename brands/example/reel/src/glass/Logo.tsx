// Visual before text: what's named (an app, an AI, a network) is shown with its real logo, not its written name.
// The SVGs live in this project's public/logos/ and come from free libraries (README.md, «Logos»):
//   simple-icons (CC0, one color)  ·  @lobehub/icons-static-svg (MIT, AI logos; «-color» files are in full color)
// This repo ships no logo files: copy the ones a piece needs first. A missing colored file stops the render (Remotion's
// <Img> fails to load it); a missing one-color file draws nothing.
import type { CSSProperties } from "react";
import { Img, staticFile } from "remotion";
import { DISPLAY } from "./theme";

export type LogoProps = {
  /** The file name in public/logos/, without «.svg» («claude-color», «tiktok»). */
  name: string;
  /** Width and height, in px. */
  size: number;
  /** Paint for one-color logos (ignored for colored ones). */
  color?: string;
  /** Force how it's drawn. By default, names ending in «-color» are drawn as they are; the rest are painted with `color`. */
  colored?: boolean;
  style?: CSSProperties;
};

/**
 * A real logo from public/logos/. Colored SVGs go in as an image; one-color SVGs are painted with `color` through a
 * CSS mask, so the same file works white over glass or in the brand's accent.
 */
export const Logo = ({ name, size, color = "#fff", colored = name.endsWith("-color"), style }: LogoProps) => {
  const src = staticFile(`logos/${name}.svg`);
  if (colored) return <Img src={src} style={{ width: size, height: size, objectFit: "contain", ...style }} />;
  const mask = `url("${src}")`;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: color,
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        ...style,
      }}
    />
  );
};

/**
 * An app tile with its letters (a rounded square, like a desktop app's icon), for a tool that has no logo file at
 * hand. Needs no files. Use the app's own colors when it's a real one.
 */
export const AppIcon = ({ letters, size, background = "#0b1122", color = "#fff", style }: { letters: string; size: number; background?: string; color?: string; style?: CSSProperties }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.22,
      background,
      border: `${Math.max(2, size * 0.035)}px solid ${color}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: DISPLAY,
      fontWeight: 700,
      fontSize: size * 0.36,
      letterSpacing: 0,
      color,
      boxShadow: "0 12px 30px rgb(0 0 0 / 0.45)",
      ...style,
    }}
  >
    {letters}
  </div>
);
