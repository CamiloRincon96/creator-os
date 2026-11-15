// Explainer: the daily reel from a voice note by the creator (or any voice), with the brand's kit.
// production/tools/note.py builds it: the cut voice and its timed words + an explainer.json with the scenes
// (each with its type and its data). Claude writes the scenes from what is said; nothing is decided here.
//
// Scene types: title · number · list · clip (own footage from library/) · app (balance, transactions, log)
// · outro. Between scenes, the brand's sweep; entrances get motion blur (editing guide, 15 Nov 2026:
// «nothing pops in without intent»). Captions word by word, the one being spoken in mint.
import { CameraMotionBlur } from "@remotion/motion-blur";
import type { CalculateMetadataFunction } from "remotion";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
import { LightBackground, Phone } from "../kit/scenes";
import { BACKGROUND, C, fontFamily, LOGO, SPRING } from "../brand";
import { AppScreen } from "./screens";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const springAt = (frame: number, from: number) => (frame < from ? 0 : spring({ frame: frame - from, fps: FPS, config: SPRING }));

type Word = { t: string; start: number; end: number };
export type Scene =
  | { type: "title"; start: number; end: number; text: string; kicker?: string }
  | { type: "number"; start: number; end: number; value: number; prefix?: string; label: string; tone?: "accent" | "coral" }
  | { type: "list"; start: number; end: number; title?: string; items: string[]; at?: number[] }
  | { type: "clip"; start: number; end: number; video: string; from?: number; text?: string }
  | { type: "app"; start: number; end: number; screen: "balance" | "transactions" | "log"; amount?: number; items?: [string, string][]; said?: string; category?: string; text?: string }
  | { type: "outro"; start: number; end: number; cta: string; sub?: string };
export type Data = { folder: string; voice: string; duration: number; words: Word[]; scenes: Scene[]; noCaptions?: number[] };
export type ExplainerProps = { data: string; preloaded?: Data };

export const calculateExplainer: CalculateMetadataFunction<ExplainerProps> = async ({ props }) => {
  const d: Data = props.preloaded ?? (await (await fetch(staticFile(props.data))).json());
  return { durationInFrames: Math.max(30, f(d.duration)), props: { ...props, preloaded: d } };
};

const formatNumber = (n: number) => Math.round(n).toLocaleString("en-US");
/** «*word*» in mint. */
const Marked = ({ text }: { text: string }) => (
  <>
    {text.split(/(\*[^*]+\*)/).filter(Boolean).map((p, i) =>
      p.startsWith("*") ? (
        <span key={i} style={{ color: C.mint }}>
          {p.slice(1, -1)}
        </span>
      ) : (
        <span key={i}>{p}</span>
      ),
    )}
  </>
);

const Title = ({ e }: { e: Extract<Scene, { type: "title" }> }) => {
  const frame = useCurrentFrame();
  const words = e.text.split(" ");
  return (
    <AbsoluteFill>
      <LightBackground cy={42} />
      <div style={{ position: "absolute", left: 90, right: 90, top: 560, fontFamily }}>
        {e.kicker ? <div style={{ color: C.mint, fontWeight: 700, fontSize: 40, letterSpacing: "0.2em", marginBottom: 24, opacity: interpolate(frame, [0, 6], [0, 1], clamp) }}>{e.kicker.toUpperCase()}</div> : null}
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 112, lineHeight: 1.02, letterSpacing: "-0.035em", textWrap: "balance" }}>
          {words.map((w, i) => {
            const r = springAt(frame, i * 3);
            return (
              <span key={i} style={{ display: "inline-block", opacity: r, translate: `0px ${(1 - r) * 30}px`, marginRight: "0.25em" }}>
                <Marked text={w} />
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const NumberScene = ({ e }: { e: Extract<Scene, { type: "number" }> }) => {
  const frame = useCurrentFrame();
  const duration = f(e.end - e.start);
  const p = interpolate(frame, [4, Math.max(10, duration * 0.6)], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  const color = e.tone === "coral" ? C.coral : C.mint;
  return (
    <AbsoluteFill>
      <LightBackground cy={45} warm={e.tone === "coral" ? 0.12 : 0.07} />
      <div style={{ position: "absolute", left: 60, right: 60, top: 620, textAlign: "center", fontFamily }}>
        <div style={{ color, fontWeight: 800, fontSize: 210, letterSpacing: "-0.05em", lineHeight: 1, fontVariantNumeric: "tabular-nums", scale: String(0.9 + 0.1 * springAt(frame, 0)) }}>
          {e.prefix ?? ""}
          {formatNumber(e.value * p)}
        </div>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 64, marginTop: 30, opacity: interpolate(frame, [8, 14], [0, 1], clamp) }}>
          <Marked text={e.label} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const List = ({ e }: { e: Extract<Scene, { type: "list" }> }) => {
  const frame = useCurrentFrame();
  const duration = f(e.end - e.start);
  const entrances = e.items.map((_, i) => (e.at?.[i] !== undefined ? f(e.at[i] - e.start) : Math.round((i * duration * 0.7) / e.items.length) + 4));
  return (
    <AbsoluteFill>
      <LightBackground cy={40} />
      <div style={{ position: "absolute", left: 90, right: 90, top: 380, fontFamily }}>
        {e.title ? <div style={{ color: "#fff", fontWeight: 800, fontSize: 84, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 60 }}><Marked text={e.title} /></div> : null}
        {e.items.map((it, i) => {
          const r = springAt(frame, entrances[i]);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 30, marginBottom: 38, opacity: r, translate: `${(1 - r) * -40}px 0px` }}>
              <div style={{ width: 76, height: 76, flex: "none", borderRadius: 24, background: C.mint, color: C.deeper, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 44 }}>{i + 1}</div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 58, lineHeight: 1.12 }}>
                <Marked text={it} />
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Clip = ({ e, folder }: { e: Extract<Scene, { type: "clip" }>; folder: string }) => {
  const frame = useCurrentFrame();
  const duration = f(e.end - e.start);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ scale: String(interpolate(frame, [0, duration], [1.04, 1.12], clamp)) }}>
        <OffthreadVideo src={staticFile(`${folder}/${e.video}`)} trimBefore={f(e.from ?? 0)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgb(${BACKGROUND.veil} / 0.55) 0%, rgb(${BACKGROUND.veil} / 0) 30%, rgb(${BACKGROUND.veil} / 0) 60%, rgb(${BACKGROUND.veil} / 0.5) 100%)` }} />
      {e.text ? (
        <div style={{ position: "absolute", left: 80, right: 80, top: 230, fontFamily, color: "#fff", fontWeight: 800, fontSize: 88, lineHeight: 1.04, letterSpacing: "-0.03em", textShadow: "0 8px 30px rgb(0 0 0 / 0.5)", opacity: interpolate(frame, [3, 9], [0, 1], clamp) }}>
          <Marked text={e.text} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const App = ({ e }: { e: Extract<Scene, { type: "app" }> }) => {
  const frame = useCurrentFrame();
  const r = springAt(frame, 0);
  return (
    <AbsoluteFill>
      <LightBackground cy={55} />
      {e.text ? <div style={{ position: "absolute", left: 80, right: 80, top: 190, fontFamily, color: "#fff", fontWeight: 800, fontSize: 80, lineHeight: 1.05, letterSpacing: "-0.03em" }}><Marked text={e.text} /></div> : null}
      <div style={{ position: "absolute", inset: 0, translate: `0px ${(1 - r) * 140}px`, opacity: r }}>
        {/* the phone ends before y = 1,320: the white captions go below it, and they can't be read over the light screen */}
        <Phone width={420} top={e.text ? 370 : 330}>
          <AppScreen e={e} />
        </Phone>
      </div>
    </AbsoluteFill>
  );
};

const Outro = ({ e }: { e: Extract<Scene, { type: "outro" }> }) => {
  const frame = useCurrentFrame();
  const r = springAt(frame, 0);
  const r2 = springAt(frame, 10);
  return (
    <AbsoluteFill>
      <LightBackground cy={45} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 560, display: "flex", flexDirection: "column", alignItems: "center", fontFamily, textAlign: "center" }}>
        <Img src={staticFile(LOGO)} style={{ width: 560, opacity: r, scale: String(0.9 + 0.1 * r) }} />
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 84, marginTop: 70, letterSpacing: "-0.03em", lineHeight: 1.05, padding: "0 80px", opacity: r2, translate: `0px ${(1 - r2) * 20}px` }}>
          <Marked text={e.cta} />
        </div>
        {e.sub ? <div style={{ color: C.mint, fontWeight: 700, fontSize: 48, marginTop: 30, opacity: springAt(frame, 18) }}>{e.sub}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

/** The brand's sweep between scenes, with motion blur only while something comes in or goes out. */
const WithMotion = ({ duration, first, last, children }: { duration: number; first: boolean; last: boolean; children: React.ReactNode }) => {
  const frame = useCurrentFrame();
  const enter = first ? 0 : interpolate(frame, [0, 6], [1, 0], clamp);
  const exit = last ? 0 : interpolate(frame, [duration - 4, duration], [0, 1], clamp);
  const content = <AbsoluteFill style={{ filter: enter + exit > 0 ? `blur(${20 * (enter + exit)}px)` : undefined, scale: String(1 + 0.08 * enter + 0.1 * exit) }}>{children}</AbsoluteFill>;
  return frame < 10 ? (
    <CameraMotionBlur shutterAngle={180} samples={6}>
      {content}
    </CameraMotionBlur>
  ) : (
    content
  );
};

const Captions = ({ d }: { d: Data }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  if ((d.noCaptions ?? []).some((i) => t >= d.scenes[i].start && t < d.scenes[i].end)) return null;
  const groups: { start: number; end: number; ws: Word[] }[] = [];
  let current: Word[] = [];
  d.words.forEach((w, i) => {
    current.push(w);
    const next = d.words[i + 1];
    const cut = next ? d.scenes.some((e) => w.start < e.start && next.start >= e.start) : true;
    if (!next || cut || /[.?!]$/.test(w.t) || current.length >= 4 || (current.length >= 2 && (/[,:;]$/.test(w.t) || next.start - w.end > 0.18))) {
      groups.push({ start: current[0].start - 0.04, end: w.end + 0.25, ws: current });
      current = [];
    }
  });
  groups.forEach((g, i) => groups[i + 1] && (g.end = Math.min(g.end, groups[i + 1].start)));
  const g = groups.find((x) => t >= x.start && t < x.end);
  if (!g) return null;
  const enter = f(g.start);
  return (
    <div style={{ position: "absolute", left: 80, right: 80, top: 1330, height: 170, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily, fontWeight: 800, fontSize: 62, lineHeight: 1.12, textAlign: "center", textWrap: "balance", color: "#fff", textShadow: "0 3px 6px rgb(0 0 0 / 0.45), 0 10px 30px rgb(0 0 0 / 0.45)", scale: String(interpolate(frame, [enter, enter + 4], [0.94, 1], clamp)) }}>
        {g.ws.map((w, i) => (
          <span key={`${w.start}`} style={{ color: t >= w.start - 0.02 && t < (g.ws[i + 1]?.start ?? g.end) ? C.mint : "#fff" }}>
            {w.t}
            {i < g.ws.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
};

export const Explainer = ({ preloaded }: ExplainerProps) => {
  if (!preloaded) return null;
  const d = preloaded;
  return (
    <AbsoluteFill style={{ background: C.deeper }}>
      {d.scenes.map((e, i) => {
        const from = f(e.start);
        const duration = f(e.end) - from;
        return (
          <Sequence key={i} from={from} durationInFrames={duration} name={`${i + 1} · ${e.type}`}>
            <WithMotion duration={duration} first={i === 0} last={i === d.scenes.length - 1}>
              {e.type === "title" ? <Title e={e} /> : null}
              {e.type === "number" ? <NumberScene e={e} /> : null}
              {e.type === "list" ? <List e={e} /> : null}
              {e.type === "clip" ? <Clip e={e} folder={d.folder} /> : null}
              {e.type === "app" ? <App e={e} /> : null}
              {e.type === "outro" ? <Outro e={e} /> : null}
            </WithMotion>
          </Sequence>
        );
      })}
      <Captions d={d} />
      {d.voice ? <Audio src={staticFile(`${d.folder}/${d.voice}`)} /> : null}
    </AbsoluteFill>
  );
};
