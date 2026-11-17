// A feed of reels, for when the script talks about «everything out there»: each tile is a reel with a generic
// interface (heart, comments, share, user, caption, progress bar, no network's logo). The columns spin like a slot
// machine and stop one by one on the same reel: «it all came out the same». This is the only generic thing in a
// piece, and it goes in on purpose. Then the camera goes through the center reel, which already shows the next shot.
// Frames are relative to its Sequence (frame 0 = the feed appears).
import { Video } from "@remotion/media";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../brand";
import { clamp, FONT, GLASS, rgba } from "./theme";

/** One reel in the feed. `image` is a still (light to render); `video` plays only on the reels near the center. Paths relative to public/. */
export type ReelTile = { text: string; image?: string; video?: string; videoFrom?: number };

export type ReelFeedProps = {
  /** The reel every column lands on. Use the person's own take: it's their reel that looks like all the others. */
  same: ReelTile;
  /** What spins past before the columns stop. By default, generic hooks on placeholder tiles. */
  others?: ReelTile[];
  /** What the center reel shows while the camera goes through it (the first frame of the next shot). */
  next?: ReelTile;
  /** The handle on every reel: a placeholder, not a real account. */
  user?: string;
  /** A small photo for the avatar; without it, a circle with the initial. */
  avatar?: string;
  /** The line under the handle. */
  caption?: string;
  /** Frame where each of the 5 columns stops, left to right (the center one barely spins: the camera starts there). */
  stops?: [number, number, number, number, number];
  /** Frame where they all beat at once. */
  pulseAt?: number;
  /** Frame where the camera starts going through the center reel… */
  diveAt?: number;
  /** …and the frame where it fills the screen. From here on the feed is gone: put the next shot here. */
  end?: number;
};

const TW = 252;
const TH = 448; // 9:16: filling the screen it ends up exactly 1080 × 1920
const GAP = 22;
const STEP = TH + GAP;
const CENTER = { x: 540, y: 800 };
const COLUMNS = [
  { c: -2, spins: -7 },
  { c: -1, spins: 6 },
  { c: 0, spins: 0 },
  { c: 1, spins: -6 },
  { c: 2, spins: 7 },
];
const wrap = (r: number) => ((((r + 4) % 9) + 9) % 9) - 4; // rows -4 to 4

/** The hooks everyone uses: generic on purpose. */
export const GENERIC_HOOKS: ReelTile[] = ["YOU WON'T BELIEVE THIS", "THIS CHANGES EVERYTHING", "THE SECRET", "WATCH THIS", "NOBODY TELLS YOU", "IN 5 MINUTES"].map((text) => ({ text }));

const PLACEHOLDERS = [
  `linear-gradient(160deg, ${C.noteFrom}, ${C.deeper})`,
  `linear-gradient(200deg, ${rgba(C.warm, 0.45)}, ${C.deeper} 70%)`,
  `linear-gradient(160deg, ${C.ink}, ${C.deep})`,
  `linear-gradient(200deg, ${rgba(C.coral, 0.4)}, ${C.ink} 70%)`,
  `linear-gradient(160deg, ${rgba(C.mint, 0.35)}, ${C.deeper} 70%)`,
  `linear-gradient(200deg, ${C.deep}, ${C.noteFrom})`,
];
const SAME_PLACEHOLDER = `linear-gradient(160deg, ${rgba(GLASS.accent, 0.6)}, ${C.deeper} 75%)`;

const Media = ({ tile, play, index }: { tile: ReelTile; play: boolean; index: number }) => {
  const cover = { width: "100%", height: "100%", objectFit: "cover", filter: "saturate(1.15) contrast(1.05)" } as const;
  if (play && tile.video) return <Video src={staticFile(tile.video)} trimBefore={tile.videoFrom ?? 0} muted style={cover} />;
  if (tile.image) return <Img src={staticFile(tile.image)} style={cover} />;
  return <div style={{ width: "100%", height: "100%", background: index < 0 ? SAME_PLACEHOLDER : PLACEHOLDERS[index % PLACEHOLDERS.length] }} />;
};

const ICON = { stroke: "#fff", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** A reel's interface, generic (no network's logo). */
export const ReelUI = ({ progress, text, user, avatar, caption }: { progress: number; text: string; user: string; avatar?: string; caption: string }) => (
  <>
    {/* the hook text in the look every generic reel has: heavy yellow with a black outline */}
    <div style={{ position: "absolute", left: 0, right: 0, top: TH * 0.55, textAlign: "center", fontFamily: FONT.sans, fontWeight: 800, fontSize: 30, color: "#FFE600", WebkitTextStroke: "2px #000", textShadow: "0 3px 0 #000", letterSpacing: 0.5, lineHeight: 1.05, padding: "0 10px" }}>{text}</div>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 62%, rgb(0 0 0 / 0.6))" }} />
    <div style={{ position: "absolute", right: 9, bottom: 76, display: "flex", flexDirection: "column", gap: 15, alignItems: "center", filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.7))" }}>
      <svg width={24} height={24} viewBox="0 0 24 24"><path {...ICON} d="M12 20.5s-7.5-4.6-9.2-9.1C1.5 7.9 3.7 4.8 7 4.8c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.3 0 5.5 3.1 4.2 6.6-1.7 4.5-9.2 9.1-9.2 9.1z" /></svg>
      <svg width={24} height={24} viewBox="0 0 24 24"><path {...ICON} d="M20.5 11.6a8.4 8.4 0 0 1-12.2 7.5L3.5 20.5l1.4-4.6A8.4 8.4 0 1 1 20.5 11.6z" /></svg>
      <svg width={24} height={24} viewBox="0 0 24 24"><path {...ICON} d="M21 3 10.2 13.8M21 3l-6.6 18-4.2-7.2L3 9.6z" /></svg>
      <svg width={24} height={24} viewBox="0 0 24 24"><g fill="#fff"><circle cx={5} cy={12} r={1.7} /><circle cx={12} cy={12} r={1.7} /><circle cx={19} cy={12} r={1.7} /></g></svg>
    </div>
    <div style={{ position: "absolute", left: 10, right: 46, bottom: 13, fontFamily: FONT.sans, color: "#fff", textShadow: "0 1px 3px rgb(0 0 0 / 0.75)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {avatar ? (
          <Img src={staticFile(avatar)} style={{ width: 22, height: 22, borderRadius: 11, objectFit: "cover", border: "1.5px solid #fff" }} />
        ) : (
          <div style={{ width: 22, height: 22, borderRadius: 11, background: GLASS.accent, color: C.deeper, border: "1.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>{user.slice(0, 1).toUpperCase()}</div>
        )}
        <span style={{ fontWeight: 700, fontSize: 14 }}>{user}</span>
        <span style={{ fontWeight: 600, fontSize: 11, border: "1px solid rgb(255 255 255 / 0.85)", borderRadius: 6, padding: "1px 6px" }}>Follow</span>
      </div>
      <div style={{ fontWeight: 500, fontSize: 12, marginTop: 5 }}>{caption}</div>
      <div style={{ fontWeight: 500, fontSize: 10.5, marginTop: 4, opacity: 0.85 }}>♪ Original audio</div>
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "rgb(255 255 255 / 0.3)" }}>
      <div style={{ width: `${progress * 100}%`, height: "100%", background: "#fff" }} />
    </div>
  </>
);

export const ReelFeed = ({ same, others = GENERIC_HOOKS, next, user = "your.account", avatar, caption = "My AI-edited reel", stops = [43, 26, 2, 34, 49], pulseAt = 76, diveAt = 82, end = 92 }: ReelFeedProps) => {
  const F = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (F >= end) return null;
  const pool = others.length ? others : [same];
  // the camera starts close on the center reel and pulls back while the columns spin
  const back = interpolate(F, [0, Math.max(1, pulseAt - 14)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const pulse = interpolate(F, [pulseAt, pulseAt + 2, pulseAt + 9], [0, 1, 0], clamp);
  const dive = interpolate(F, [diveAt, Math.max(diveAt + 1, end)], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const scale = (2.6 - 1.6 * back) * (1 + (width / TW - 1) * dive);
  const dy = (height / 2 - CENTER.y) * Math.max(dive, 1 - back);
  const progress = interpolate(F, [0, end], [0.15, 0.85], clamp);
  const spun = (k: number, g: number) => COLUMNS[k].spins * STEP * interpolate(g, [0, Math.max(1, stops[k])], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: "#07080a" }}>
      <AbsoluteFill style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px`, transform: `translateY(${dy}px) scale(${scale})` }}>
        {COLUMNS.flatMap((col, k) => {
          const off = spun(k, F);
          const speed = Math.abs(off - spun(k, F - 1));
          return Array.from({ length: 9 }, (_, i) => {
            const r = i - 4;
            const lands = wrap(r + col.spins); // the row this reel ends on when its column stops
            const yy = ((((r * STEP + off + 4.5 * STEP) % (9 * STEP)) + 9 * STEP) % (9 * STEP)) - 4.5 * STEP;
            const center = col.c === 0 && lands === 0;
            const inView = Math.abs(lands) <= 2; // the ones in view when they stop: all the same
            const near = Math.abs(lands) <= 1 && Math.abs(col.c) <= 1;
            const index = (((i * 7 + col.c * 3) % pool.length) + pool.length) % pool.length;
            const tile = inView ? same : pool[index];
            const frame = center ? 1 - dive : 1;
            return (
              <div
                key={`${col.c}:${i}`}
                style={{
                  position: "absolute",
                  left: CENTER.x - TW / 2 + col.c * (TW + GAP),
                  top: CENTER.y - TH / 2 + yy,
                  width: TW,
                  height: TH,
                  borderRadius: 24 * frame,
                  overflow: "hidden",
                  scale: String(1 + 0.05 * pulse),
                  filter: center ? "none" : `blur(${Math.min(14, speed * 0.05) + (near ? 0 : 4) * back + dive * 8}px) brightness(${near ? 1 : 0.72})`,
                  border: `${1.5 * frame}px solid rgb(255 255 255 / ${0.3 + 0.6 * pulse})`,
                  boxShadow: frame > 0.5 ? `0 20px 50px rgb(0 0 0 / 0.5), 0 0 ${30 * pulse}px rgb(255 255 255 / ${0.5 * pulse})` : "none",
                  background: "#000",
                }}
              >
                <Media tile={tile} play={near} index={inView ? -1 : index} />
                {center && next && dive > 0 ? (
                  <div style={{ position: "absolute", inset: 0, opacity: interpolate(F, [diveAt + 1, diveAt + 7], [0, 1], clamp) }}>
                    <Media tile={next} play={false} index={-1} />
                  </div>
                ) : null}
                <div style={{ position: "absolute", inset: 0, opacity: center ? 1 - dive * 3 : 1 }}>
                  <ReelUI progress={progress} text={tile.text} user={user} avatar={avatar} caption={caption} />
                </div>
              </div>
            );
          });
        })}
      </AbsoluteFill>
      {/* a dark band so the captions read over the feed */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1310, height: 400, opacity: 1 - dive, background: "linear-gradient(180deg, transparent, rgb(0 0 0 / 0.62) 35%, rgb(0 0 0 / 0.62) 65%, transparent)" }} />
    </AbsoluteFill>
  );
};
