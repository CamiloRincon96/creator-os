// Pieces come out from behind the person and the previous one moves back. Nothing appears and disappears in place.
// Layer order (it's what makes «behind» work): the take → the pieces → the person's cutout (cutout-person.mjs) on top.
// With the kit's `Person`, the pieces go in its `behind` prop. Check the cutout on the frames where a piece starts:
// at night, with a dark t-shirt and movement, it fails.
import { useContext, type ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FootageClock } from "./Glass";
import { clamp, SPRING_OUT } from "./theme";

type Point = { x: number; y: number };

export type ComeFromBehindProps = {
  /** Frame it starts coming out (relative to the current Sequence). */
  from: number;
  /** Frame it starts moving back, smaller and blurred, because the next one is coming in. Without it, it stays. */
  until?: number;
  /** Where it starts: behind the person's head, measured on the take (screen coordinates). */
  behind: Point;
  /** The center of where it lands (usually the center of its panel). */
  to: Point;
  /** How much it turns in 3D on the way out, in degrees. */
  turn?: number;
  children: ReactNode;
};

/** Wraps any piece: it starts small behind the head (the cutout covers it) and springs out to its place with a 3D turn. */
export const ComeFromBehind = ({ from, until, behind, to, turn = 40, children }: ComeFromBehindProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clock = useContext(FootageClock);
  if (frame < from || (until !== undefined && frame > until + 10)) return null;
  const p = spring({ frame: frame - from, fps, config: SPRING_OUT });
  const back = until === undefined ? 0 : interpolate(frame, [until, until + 10], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const dx = (behind.x - to.x) * (1 - p) + back * 50;
  const dy = (behind.y - to.y) * (1 - p) - back * 60;
  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(1, p * 2.5) * (1 - back),
        translate: `${dx}px ${dy}px`,
        scale: String((0.42 + 0.58 * p) * (1 - 0.2 * back)),
        transformOrigin: `${to.x}px ${to.y}px`,
        transform: `perspective(1600px) rotateY(${(1 - p) * -turn}deg) rotateZ(${(1 - p) * 6}deg)`,
        filter: `blur(${back * 10}px)`,
      }}
    >
      <Sequence from={from} layout="none">
        <FootageClock.Provider value={clock + from}>{children}</FootageClock.Provider>
      </Sequence>
    </AbsoluteFill>
  );
};
