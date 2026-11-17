// Fine film grain: a texture that changes every frame. It's what separates real footage from a clean template, and
// it ties takes from different days into one world. Goes on top of full-screen scenes (strength ≈ 0.18).
import { useId } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export const FilmGrain = ({ strength = 0.18 }: { strength?: number }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const id = `grain-${useId().replace(/[^a-zA-Z0-9]/g, "")}-${frame}`;
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: strength, pointerEvents: "none" }}>
      <svg width={width} height={height}>
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 97} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} />
      </svg>
    </AbsoluteFill>
  );
};
