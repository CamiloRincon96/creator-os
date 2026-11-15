// Hook text for the variations (stage 12 of /creator-reel): a band at the top with the line that opens the reel.
// Transparent background: variations.py renders it in ProRes 4444 and lays it over the first seconds.
// «*word*» comes out in mint. Example's safe zone: titles between y = 190 and 400.
import type { CalculateMetadataFunction } from "remotion";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BACKGROUND, C, fontFamily, SPRING } from "../brand";

export type HookTextProps = { text: string; seconds: number };

export const calculateHook: CalculateMetadataFunction<HookTextProps> = ({ props }) => ({
  durationInFrames: Math.max(15, Math.round((props.seconds || 2.5) * 30)),
});

const parts = (text: string) => text.split(/(\*[^*]+\*)/).filter(Boolean);

export const HookText = ({ text }: HookTextProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const r = spring({ frame, fps, config: SPRING });
  const out = interpolate(frame, [durationInFrames - 6, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const length = text.replace(/\*/g, "").length;
  const size = length > 34 ? 76 : length > 24 ? 86 : 96;
  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      <div
        style={{
          position: "absolute",
          // covers the video's whole title zone (y = 60 to 470): not even the opening zoom-in, which pushes them up, lets one peek out
          left: 50,
          right: 50,
          top: 60,
          minHeight: 410,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "40px 48px 40px",
          borderRadius: 36,
          background: `rgb(${BACKGROUND.veil} / 0.96)`,
          boxShadow: `0 30px 70px rgb(0 0 0 / 0.45), inset 0 0 0 2px rgb(${BACKGROUND.light} / 0.35)`,
          fontFamily,
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1.08,
          letterSpacing: "-0.025em",
          color: "#fff",
          textAlign: "center",
          textWrap: "balance",
          opacity: interpolate(frame, [0, 3], [0, 1], { extrapolateRight: "clamp" }) * (1 - out),
          translate: `0px ${(1 - r) * -40 - out * 20}px`,
          scale: String(0.92 + 0.08 * r),
        }}
      >
        {/* a single text block: if each part were a child of the flex column, each would land on its own line */}
        <div>
          {parts(text).map((p, i) =>
            p.startsWith("*") ? (
              <span key={i} style={{ color: C.mint }}>
                {p.slice(1, -1)}
              </span>
            ) : (
              <span key={i}>{p}</span>
            ),
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
