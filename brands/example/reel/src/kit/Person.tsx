// Kit for the «scenes and cameos» style: the person with a big word behind their head.
// Uses two layers of the same block (production/tools/cutout-person.mjs): the full video underneath and the
// cut-out person on top, identical in color. The word goes between them. Both layers share position, size and
// timing.
//
// Lessons from 13 Nov 2026 («Sin anotar», a Spanish-language piece, stage 6):
// - Blurring the background leaves a dark halo around the hair (the background still contains the person).
// - Treating the background differently from the person (darker, desaturated) exposes the cutout's mistakes:
//   wherever the cutout leaves the person half transparent (the shirt, a moving hand) a stain shows up.
//   That's why both layers stay identical and any image effect (vignette) goes on top of everything, equally.
// - Always review at full size and in motion.
import { Video } from "@remotion/media";
import type { ReactNode } from "react";
import { AbsoluteFill, staticFile } from "remotion";

export type PersonProps = {
  /** The block in color (image/blocks/B01-v2.mp4), relative to public/. */
  src: string;
  /** The cut-out person (B01-v2-front.webm, from cutout-person.mjs), relative to public/. */
  front: string;
  /** Frame of the block where it starts (to line it up with the piece). */
  fromFrame?: number;
  /** 0 to 1: how dark the corners get, over the whole image. */
  vignette?: number;
  /** What goes between the background and the person (the big word). Without this, the cutout isn't used. */
  behind?: ReactNode;
  /** What goes in front of the person (cards, text). */
  overlay?: ReactNode;
};

export const Person = ({ src, front, fromFrame = 0, vignette = 0.18, behind, overlay }: PersonProps) => {
  const layer = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } as const;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <Video src={staticFile(src)} trimBefore={fromFrame} muted style={layer} />
      {behind ? (
        <>
          <AbsoluteFill>{behind}</AbsoluteFill>
          <Video src={staticFile(front)} trimBefore={fromFrame} muted style={layer} />
        </>
      ) : null}
      {vignette > 0 ? (
        <AbsoluteFill style={{ background: `radial-gradient(80% 60% at 50% 42%, rgb(0 0 0 / 0) 60%, rgb(0 0 0 / ${vignette}) 100%)` }} />
      ) : null}
      {overlay ? <AbsoluteFill>{overlay}</AbsoluteFill> : null}
    </AbsoluteFill>
  );
};
