// Mockup for stage 5 of the /creator-reel workflow: the piece's rhythm before designing anything.
// Reads a piece's visual-script.json (production/tools/visual_script.py builds it and
// production/tools/mockup.py copies it to public/pieces/<piece>/). No design: the real take where the
// person appears, gray cards where a scene goes, the zoom-ins where they land and the captions.
import { Audio, Video } from "@remotion/media";
import type { CalculateMetadataFunction } from "remotion";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { fontFamily } from "../brand";

type Scene = {
  n: number;
  shot: string;
  start: number;
  end: number;
  shows?: string;
  text?: string;
  camera?: string;
  accent_t?: number;
  accents_t?: number[];
  says?: string;
};
type Word = { t: string; start: number; end: number };
export type MockupProps = {
  folder: string;
  fps: number;
  duration: number;
  voice: string;
  cut_video: string;
  scenes: Scene[];
  phrases: { id: string; start: number; end: number }[];
  words: Word[];
};

/** Shots where the person appears (the `shot` column of the script). The others: SCENE (gray card) and OUTRO. */
const PERSON = new Set(["CAMERA", "CAMEO", "CAMERA + CARD"]);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const calculateMockup: CalculateMetadataFunction<MockupProps> = ({ props }) => ({
  durationInFrames: props.duration,
  fps: props.fps,
  width: 1080,
  height: 1920,
});

/** The scene's zoom-in: snap (a one-frame jump on the word), slow (across the scene) or still (none). */
const zoom = (e: Scene, t: number) => {
  if (e.camera === "snap" && e.accents_t?.length) return 1 + 0.07 * e.accents_t.filter((x) => t >= x).length;
  if (e.camera === "snap" && e.accent_t !== undefined) return t >= e.accent_t ? 1.14 : 1;
  if (e.camera === "slow") return interpolate(t, [e.start, e.end], [1, 1.08], clamp);
  return 1;
};

const Card = ({ e, small = false }: { e: Scene; small?: boolean }) => (
  <div
    style={{
      position: "absolute",
      left: small ? 150 : 0,
      right: small ? 150 : 0,
      top: small ? 760 : 0,
      bottom: small ? 760 : 0,
      borderRadius: small ? 36 : 0,
      background: small ? "rgb(70 70 70 / 0.92)" : "linear-gradient(180deg, #4a4a4a 0%, #2e2e2e 100%)",
      border: small ? "4px solid rgb(255 255 255 / 0.5)" : "none",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: small ? 30 : 110,
      gap: 34,
      textAlign: "center",
      fontFamily,
      color: "#fff",
    }}
  >
    {!small && e.text ? <div style={{ fontWeight: 800, fontSize: 96, lineHeight: 1.05, letterSpacing: "-0.02em" }}>{e.text}</div> : null}
    <div style={{ fontWeight: 500, fontSize: small ? 38 : 44, lineHeight: 1.3, color: "rgb(255 255 255 / 0.78)" }}>{e.shows}</div>
  </div>
);

const SceneView = ({ e, p }: { e: Scene; p: MockupProps }) => {
  const frame = useCurrentFrame();
  const t = e.start + frame / p.fps;
  const person = PERSON.has(e.shot);
  return (
    <AbsoluteFill style={{ background: "#2e2e2e", overflow: "hidden" }}>
      <AbsoluteFill style={{ scale: String(zoom(e, t)), transformOrigin: "50% 40%" }}>
        {person || e.shot === "OUTRO" ? (
          <Video
            src={staticFile(`${p.folder}/${p.cut_video.split("/").pop()}`)}
            trimBefore={Math.round(e.start * p.fps)}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Card e={e} />
        )}
        {e.shot === "CAMERA + CARD" ? <Card e={e} small /> : null}
        {e.shot === "OUTRO" ? <Card e={e} /> : null}
      </AbsoluteFill>
      {/* big text over the person (the word behind, or the step's title) */}
      {person && e.text ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 230,
            textAlign: "center",
            fontFamily,
            fontWeight: 800,
            fontSize: e.shot === "CAMERA" ? 150 : 70,
            letterSpacing: "-0.02em",
            color: "rgb(255 255 255 / 0.9)",
            textShadow: "0 6px 30px rgb(0 0 0 / 0.5)",
          }}
        >
          {e.text}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Captions: the phrase being spoken, with the current word highlighted. */
const Captions = ({ p }: { p: MockupProps }) => {
  const frame = useCurrentFrame();
  const t = frame / p.fps;
  const f = p.phrases.find((x) => t >= x.start - 0.05 && t < x.end + 0.15);
  if (!f) return null;
  const ws = p.words.filter((w) => w.start >= f.start - 0.01 && w.start < f.end);
  return (
    <div style={{ position: "absolute", left: 90, right: 90, top: 1300, display: "flex", justifyContent: "center" }}>
      <div style={{ padding: "16px 30px", borderRadius: 24, background: "rgb(0 0 0 / 0.6)", fontFamily, fontWeight: 700, fontSize: 52, lineHeight: 1.2, textAlign: "center", color: "#fff" }}>
        {ws.map((w, i) => (
          <span key={`${w.start}-${i}`} style={{ color: t >= w.start && t < (ws[i + 1]?.start ?? f.end + 0.15) ? "#b6f2c9" : "#fff" }}>
            {w.t}{" "}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Label at the top: scene number, shot and second, to leave notes in Montage. */
const Label = ({ p }: { p: MockupProps }) => {
  const frame = useCurrentFrame();
  const t = frame / p.fps;
  const e = p.scenes.find((x) => t >= x.start && t < x.end) ?? p.scenes[p.scenes.length - 1];
  return (
    <div style={{ position: "absolute", left: 40, top: 60, padding: "10px 20px", borderRadius: 14, background: "rgb(0 0 0 / 0.65)", fontFamily, fontWeight: 700, fontSize: 34, color: "#fff" }}>
      {`#${e.n} · ${e.shot}${e.camera && e.camera !== "still" ? ` · ${e.camera}` : ""} · ${t.toFixed(1)} s`}
    </div>
  );
};

export const Mockup = (p: MockupProps) =>
  p.scenes.length === 0 ? (
    <AbsoluteFill style={{ background: "#2e2e2e" }} />
  ) : (
  <AbsoluteFill style={{ background: "#2e2e2e" }}>
    {p.scenes.map((e) => (
      <Sequence key={e.n} from={Math.round(e.start * p.fps)} durationInFrames={Math.max(1, Math.round((e.end - e.start) * p.fps))} name={`#${e.n} ${e.shot}`}>
        <SceneView e={e} p={p} />
      </Sequence>
    ))}
    <Captions p={p} />
    <Label p={p} />
    <Audio src={staticFile(`${p.folder}/${p.voice.split("/").pop()}`)} />
  </AbsoluteFill>
);
