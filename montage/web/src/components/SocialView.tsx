// Social view: the piece inside an approximate interface of each app (Reels, TikTok, Shorts,
// Facebook, Stories, feed and profile), to see what each one covers and how it gets cropped.
// A single <video> decodes; each phone is a canvas that copies the frame (mirror).

import {
  BatteryFull,
  Bell,
  Bookmark,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  CircleUserRound,
  Clapperboard,
  Ellipsis,
  EllipsisVertical,
  Forward,
  Globe,
  Grid3x3,
  Heart,
  House,
  Images,
  Inbox,
  LayoutGrid,
  Menu,
  MessageCircle,
  MessageCircleMore,
  MessageSquareText,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat2,
  Search,
  Send,
  Signal,
  SquarePlay,
  SquarePlus,
  SquareUser,
  Store,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-react';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SAFE_ZONES } from '../../../shared/formats.js';
import { timecode } from '../../../shared/time.js';
import { api, fileUrl, repoUrl } from '../api';
import { setStore, useStore } from '../state';
import { clock } from '../clock';
import type { VersionFile, ProjectData, Project, Version } from '../types';
import { clamp, cx, isTyping } from '../util';
import { paintTimecode } from './Controls';
import './SocialView.css';

// Logical screen of a 6.1" phone (points), its bezel and the 9:16 frame under the status bar.
const SCREEN = { width: 320, height: 693 };
const BEZEL = 9;
const PHONE = { width: SCREEN.width + BEZEL * 2, height: SCREEN.height + BEZEL * 2 };
const STATUS_BAR = 44;
const HEIGHT_916 = Math.round((SCREEN.width * 16) / 9);
const CAPTION = 40;
const GAP = 28;

type PlatformId = 'ig-reels' | 'tiktok' | 'shorts' | 'fb-reels' | 'ig-story' | 'ig-feed' | 'ig-profile' | 'fb-feed';
type Fit = 'cover' | 'contain';

interface Platform {
  id: PlatformId;
  network: string;
  name: string;
  format: string;
  image: boolean;
}

const PLATFORMS: Platform[] = [
  { id: 'ig-reels', network: 'Instagram', name: 'Reels', format: '9:16 full screen', image: false },
  { id: 'tiktok', network: 'TikTok', name: 'For You', format: '9:16 full screen', image: true },
  { id: 'shorts', network: 'YouTube', name: 'Shorts', format: '9:16 full screen', image: false },
  { id: 'fb-reels', network: 'Facebook', name: 'Reels', format: '9:16 full screen', image: false },
  { id: 'ig-story', network: 'Instagram', name: 'Story', format: '9:16 with message bar', image: true },
  { id: 'ig-feed', network: 'Instagram', name: 'Feed', format: 'up to 4:5 in the feed', image: true },
  { id: 'ig-profile', network: 'Instagram', name: 'Profile', format: '3:4 grid', image: true },
  { id: 'fb-feed', network: 'Facebook', name: 'Feed', format: 'up to 4:5 in the feed', image: true },
];

/** Real account of each brand (brands/<brand>/PROFILE.md, BRAND.md). */
const ACCOUNTS: Record<string, string> = {
  example: 'example',
};

const close = (a: number, b: number) => Math.abs(a - b) < 0.02;

// ---------------------------------------------------------------- mirror

interface Canvas {
  canvas: HTMLCanvasElement;
  fit: Fit;
  w: number;
  h: number;
}

function paintSource(ctx: CanvasRenderingContext2D, f: CanvasImageSource, fw: number, fh: number, cw: number, ch: number, fit: Fit) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cw, ch);
  const rf = fw / fh;
  const rc = cw / ch;
  if (fit === 'cover') {
    let sx = 0;
    let sy = 0;
    let sw = fw;
    let sh = fh;
    if (rf > rc) {
      sw = fh * rc;
      sx = (fw - sw) / 2;
    } else {
      sh = fw / rc;
      sy = (fh - sh) / 2;
    }
    ctx.drawImage(f, sx, sy, sw, sh, 0, 0, cw, ch);
  } else {
    let dw = cw;
    let dh = ch;
    if (rf > rc) dh = cw / rf;
    else dw = ch * rf;
    ctx.drawImage(f, 0, 0, fw, fh, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }
}

class Mirror {
  source: HTMLVideoElement | HTMLImageElement | null = null;
  private canvases = new Set<Canvas>();
  private listeners = new Set<(t: number, d: number) => void>();
  private frameRequest = 0;

  attach(f: HTMLVideoElement | HTMLImageElement | null) {
    const previous = this.source;
    if (previous instanceof HTMLVideoElement) {
      previous.removeEventListener('seeked', this.paint);
      previous.removeEventListener('loadeddata', this.paint);
      previous.removeEventListener('timeupdate', this.notify);
      previous.cancelVideoFrameCallback?.(this.frameRequest);
    } else if (previous) previous.removeEventListener('load', this.paint);
    this.source = f;
    if (f instanceof HTMLVideoElement) {
      f.addEventListener('seeked', this.paint);
      f.addEventListener('loadeddata', this.paint);
      f.addEventListener('timeupdate', this.notify);
      this.requestFrame();
    } else if (f) {
      if (f.complete) this.paint();
      else f.addEventListener('load', this.paint);
    }
  }

  // Each new video frame is copied to every phone (requestVideoFrameCallback: no extra work while paused).
  private requestFrame = () => {
    const v = this.source;
    if (!(v instanceof HTMLVideoElement) || !v.requestVideoFrameCallback) return;
    this.frameRequest = v.requestVideoFrameCallback(() => {
      this.paint();
      this.requestFrame();
    });
  };

  register(c: Canvas) {
    this.canvases.add(c);
    this.paintOne(c);
    return () => {
      this.canvases.delete(c);
    };
  }

  onProgress(fn: (t: number, d: number) => void) {
    this.listeners.add(fn);
    this.notify();
    return () => {
      this.listeners.delete(fn);
    };
  }

  paint = () => {
    for (const c of this.canvases) this.paintOne(c);
    this.notify();
  };

  private notify = () => {
    const v = this.source;
    if (v instanceof HTMLVideoElement) for (const fn of this.listeners) fn(v.currentTime, v.duration || 0);
  };

  private paintOne(c: Canvas) {
    const f = this.source;
    if (!f) return;
    const isVideo = f instanceof HTMLVideoElement;
    const fw = isVideo ? f.videoWidth : f.naturalWidth;
    const fh = isVideo ? f.videoHeight : f.naturalHeight;
    if (!fw || !fh || (isVideo && f.readyState < 2)) return;
    const el = c.canvas;
    if (el.width !== c.w || el.height !== c.h) {
      el.width = c.w;
      el.height = c.h;
    }
    const ctx = el.getContext('2d');
    if (ctx) paintSource(ctx, f, fw, fh, c.w, c.h, c.fit);
  }
}

const MirrorCtx = createContext<Mirror | null>(null);
const ScaleCtx = createContext(1);

function Canvas({ fit, height, className }: { fit: Fit; height: number; className?: string }) {
  const mirror = useContext(MirrorCtx)!;
  const scale = useContext(ScaleCtx);
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    return mirror.register({ canvas: c, fit, w: Math.max(2, Math.round(c.offsetWidth * scale * dpr)), h: Math.max(2, Math.round(c.offsetHeight * scale * dpr)) });
  }, [mirror, fit, scale, height]);
  return <canvas ref={ref} className={cx('sv-canvas', className)} />;
}

// ---------------------------------------------------------------- post data

interface Post {
  account: string;
  name: string;
  text: string;
  avatar: string | null;
  ui: boolean;
  zones: boolean;
  /** Width / height of the piece. */
  r: number;
  isVideo: boolean;
  pages: number;
  page: number;
  others: string[];
}

function loadSaved<T>(key: string, initial: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...initial, ...JSON.parse(v) } : initial;
  } catch {
    return initial;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** Brand logo for the avatar: `<brand>/logo/` (profile or symbol); Example uses the app symbol. */
function useAvatar(brand: string) {
  const [url, setUrl] = useState<string | null>(brand === 'example' ? '/brand/montage-symbol.svg' : null);
  useEffect(() => {
    if (!brand || brand === 'example') return;
    let alive = true;
    api
      .repo(`${brand}/logo`)
      .then(({ entries }) => {
        const images = entries.filter((e) => e.type === 'image');
        const chosen = [/profile/i, /mark|symbol|ring/i, /./].map((re) => images.find((e) => re.test(e.name))).find(Boolean);
        if (alive && chosen) setUrl(repoUrl(chosen.path));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [brand]);
  return url;
}

function noticesFor(meta: VersionFile['meta'], isVideo: boolean) {
  const w = meta.width || 1080;
  const h = meta.height || 1920;
  const r = w / h;
  const list: { text: string; level: 'ok' | 'warning' }[] = [];
  const names = isVideo ? 'Reels, TikTok, Shorts and Stories' : 'Stories and TikTok';
  if (close(r, 9 / 16)) list.push({ text: `It's 9:16: it fills the screen in ${names}.`, level: 'ok' });
  else list.push({ text: `It's not 9:16 (${w}×${h}): in ${names} it gets black bars.`, level: 'warning' });
  if (r < 0.79) {
    const lost = Math.round((h - w / 0.8) / 2);
    list.push({ text: `In the feed it's cropped to 4:5: ${lost} px are lost at the top and ${lost} px at the bottom.`, level: 'warning' });
  } else if (r > 1.92) list.push({ text: "In the feed it's cropped to 1.91:1 on the sides.", level: 'warning' });
  else list.push({ text: 'In the feed it shows in full.', level: 'ok' });
  if (r < 0.74) {
    const lost = Math.round((h - w / 0.75) / 2);
    list.push({ text: `In the profile grid it's cropped to 3:4: ${lost} px at the top and bottom.`, level: 'warning' });
  }
  if (w < 1080 && r <= 1) list.push({ text: `It's ${w} px wide; the platforms recommend 1080 px.`, level: 'warning' });
  return list;
}

// ---------------------------------------------------------------- view

export function SocialView({ data, version }: { data: ProjectData; version: Version }) {
  const p = data.project;
  const summaries = useStore((s) => s.summaries);
  const brands = useStore((s) => s.brands);
  const selPage = useStore((s) => s.selPage);
  const page = Math.min(selPage, version.files.length - 1);
  const file = version.files[page];
  const isVideo = file.type === 'video';
  const media = data.media[file.path];
  const fps = file.meta.fps || 30;
  const r = (file.meta.width || 1080) / (file.meta.height || 1920);
  const mirror = useMemo(() => new Mirror(), []);
  const avatar = useAvatar(p.brand);

  const [settings, setSettings] = useState(() =>
    loadSaved(`montage:social:${p.id}`, { account: ACCOUNTS[p.brand] || p.brand.replace(/-/g, ''), text: p.name }),
  );
  const [view, setView] = useState(() => loadSaved('montage:social:view', { ui: true, zones: false, focus: null as PlatformId | null }));
  useEffect(() => save(`montage:social:${p.id}`, settings), [p.id, settings]);
  useEffect(() => save('montage:social:view', view), [view]);

  const available = PLATFORMS.filter((pl) => isVideo || pl.image);
  const focus = available.find((pl) => pl.id === view.focus) ?? null;
  const visible = focus ? [focus] : available;

  const post: Post = {
    account: settings.account.replace(/^@/, '') || 'your_account',
    name: brands.find((b) => b.id === p.brand)?.name || p.name,
    text: settings.text,
    avatar,
    ui: view.ui,
    zones: view.zones,
    r,
    isVideo,
    pages: version.files.length,
    page,
    others: summaries.filter((x) => x.brand === p.brand && x.id !== p.id && x.poster).map((x) => x.poster!),
  };

  return (
    <MirrorCtx.Provider value={mirror}>
      <div className="social">
        <aside className="panel social-platforms">
          <header className="panel-head">
            <h2>Social view</h2>
          </header>
          <div className="panel-body">
            <button className={cx('platform', !focus && 'sel')} aria-pressed={!focus} onClick={() => setView({ ...view, focus: null })}>
              <LayoutGrid size={16} />
              <span>
                <b>All</b>
                <small>{available.length} views side by side</small>
              </span>
            </button>
            {available.map((pl) => (
              <button key={pl.id} className={cx('platform', focus?.id === pl.id && 'sel')} aria-pressed={focus?.id === pl.id} onClick={() => setView({ ...view, focus: pl.id })}>
                <NetworkIcon network={pl.network} />
                <span>
                  <b>
                    {pl.network} · {pl.name}
                  </b>
                  <small>{pl.format}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className="panel social-stage">
          <Stage visible={visible} post={post} focused={!!focus} onSelect={(id) => setView({ ...view, focus: id })} />
          <Source project={p} file={file} src={isVideo ? media?.urls?.preview || fileUrl(p.id, file.path) : fileUrl(p.id, file.path)} isVideo={isVideo} />
          <SocialTransport isVideo={isVideo} fps={fps} pages={version.files.length} page={page} />
        </main>

        <aside className="panel social-settings">
          <header className="panel-head">
            <h2>Post</h2>
          </header>
          <div className="panel-body">
            <label className="field">
              Account
              <span className="field-at">
                <span aria-hidden>@</span>
                <input value={settings.account.replace(/^@/, '')} maxLength={30} onChange={(e) => setSettings({ ...settings, account: e.target.value.replace(/\s/g, '') })} />
              </span>
            </label>
            <label className="field">
              Post caption
              <textarea rows={5} value={settings.text} maxLength={2200} onChange={(e) => setSettings({ ...settings, text: e.target.value })} placeholder="The text that goes with the post" />
            </label>
            <p className="track">Saved on this computer for this project. Only used for the preview.</p>
            <div className="switches">
              <label className="switch">
                <input type="checkbox" checked={view.ui} onChange={(e) => setView({ ...view, ui: e.target.checked })} />
                <span>App interface</span>
              </label>
              <label className="switch">
                <input type="checkbox" checked={view.zones} onChange={(e) => setView({ ...view, zones: e.target.checked })} />
                <span>Brand safe zone</span>
              </label>
            </div>
            <section className="social-notices">
              <h3>How this piece looks</h3>
              <ul>
                {noticesFor(file.meta, isVideo).map((a) => (
                  <li key={a.text} className={`level-${a.level}`}>
                    {a.text}
                  </li>
                ))}
              </ul>
            </section>
            <p className="track">The interfaces are approximate and change often in each app. They show what each one covers and how the piece gets cropped.</p>
          </div>
        </aside>
      </div>
    </MirrorCtx.Provider>
  );
}

/** Logo of each network, drawn with the same stroke as the interface icons. */
function NetworkIcon({ network }: { network: string }) {
  return (
    <span className="network-icon" aria-hidden>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {network === 'Instagram' && (
          <>
            <rect x="3" y="3" width="18" height="18" rx="5.5" />
            <circle cx="12" cy="12" r="4.2" />
            <circle cx="17.4" cy="6.6" r="0.4" fill="currentColor" />
          </>
        )}
        {network === 'TikTok' && <path d="M13.5 3.5v11a3.75 3.75 0 1 1-3.75-3.75M13.5 3.5c.5 2.7 2.4 4.5 5.25 4.8" />}
        {network === 'YouTube' && (
          <>
            <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
            <path d="M10.2 9.4v5.2l4.4-2.6z" />
          </>
        )}
        {network === 'Facebook' && <path d="M15.5 3.5h-2a4 4 0 0 0-4 4v3h-3v3.5h3V21h3.6v-7h2.9l.7-3.5h-3.6V8a1 1 0 0 1 1-1h1.9z" />}
      </svg>
    </span>
  );
}

/** The only video (or image) that decodes; the phones copy it. */
function Source({ project, file, src, isVideo }: { project: Project; file: VersionFile; src: string; isVideo: boolean }) {
  const mirror = useContext(MirrorCtx)!;
  const ref = useRef<HTMLVideoElement & HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isVideo) {
      const v = el as HTMLVideoElement;
      const start = () => {
        if (clock.t > 0 && clock.t < (v.duration || Infinity)) v.currentTime = clock.t;
        v.play().catch(() => {});
      };
      if (v.readyState >= 1) start();
      else v.addEventListener('loadedmetadata', start, { once: true });
    }
    mirror.attach(el);
    return () => {
      if (isVideo) {
        const v = el as HTMLVideoElement;
        if (!isNaN(v.currentTime)) clock.set(v.currentTime);
        v.pause();
      }
      mirror.attach(null);
    };
  }, [mirror, src, isVideo]);
  return isVideo ? (
    <video ref={ref} className="sv-source" src={src} muted playsInline loop preload="auto" aria-hidden />
  ) : (
    <img ref={ref} className="sv-source" src={src} alt="" aria-hidden data-project={project.id} data-file={file.name} />
  );
}

function SocialTransport({ isVideo, fps, pages, page }: { isVideo: boolean; fps: number; pages: number; page: number }) {
  const mirror = useContext(MirrorCtx)!;
  const tc = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLInputElement>(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const video = () => (mirror.source instanceof HTMLVideoElement ? mirror.source : null);

  useEffect(() => {
    if (!isVideo) return;
    const off = mirror.onProgress((t, d) => {
      if (tc.current) paintTimecode(tc.current, timecode(t, fps));
      if (bar.current && document.activeElement !== bar.current) {
        bar.current.value = String(t);
        bar.current.style.setProperty('--p', `${d ? (t / d) * 100 : 0}%`);
      }
      if (d && Math.abs(d - duration) > 0.01) setDuration(d);
      const v = video();
      if (v) setPlaying(!v.paused);
    });
    return off;
  }, [mirror, isVideo, fps, duration]);

  useEffect(() => {
    const v = video();
    if (v) v.muted = muted;
  });

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const v = video();
      if (e.key === ' ' && v) {
        e.preventDefault();
        if (v.paused) v.play().catch(() => {});
        else v.pause();
        setPlaying(!v.paused);
      }
      if (pages > 1 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        setStore({ selPage: clamp(page + (e.key === 'ArrowRight' ? 1 : -1), 0, pages - 1) });
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  if (!isVideo) {
    if (pages < 2) return null;
    return (
      <div className="social-transport">
        <button className="ico" aria-label="Previous page" disabled={page === 0} onClick={() => setStore({ selPage: page - 1 })}>
          <ChevronLeft size={18} />
        </button>
        <span className="tc-total">
          Page {page + 1} of {pages}
        </span>
        <button className="ico" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setStore({ selPage: page + 1 })}>
          <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="social-transport">
      <button
        className="ico play"
        aria-label={playing ? 'Pause' : 'Play'}
        title="Play / pause (Space)"
        onClick={() => {
          const v = video();
          if (!v) return;
          if (v.paused) v.play().catch(() => {});
          else v.pause();
          setPlaying(!v.paused);
        }}
      >
        {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </button>
      <span className="tc" ref={tc}>
        <span>00:00:00</span>
        <span className="tc-frames">:00</span>
      </span>
      <input
        ref={bar}
        className="social-bar"
        type="range"
        min={0}
        max={duration || 1}
        step={1 / fps}
        defaultValue={0}
        aria-label="Position"
        onInput={(e) => {
          const v = video();
          const t = Number((e.target as HTMLInputElement).value);
          if (v) v.currentTime = t;
          (e.target as HTMLInputElement).style.setProperty('--p', `${duration ? (t / duration) * 100 : 0}%`);
        }}
      />
      <span className="tc-total">{timecode(duration, fps)}</span>
      <button className="ico" aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)}>
        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>
    </div>
  );
}

/** Lays out the phones at the largest scale that fits (columns × rows). */
function Stage({ visible, post, focused, onSelect }: { visible: Platform[]; post: Post; focused: boolean; onSelect: (id: PlatformId) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 900, h: 700 });
  useLayoutEffect(() => {
    const el = ref.current!;
    const measure = () => setBox({ w: el.clientWidth - 48, h: el.clientHeight - 40 });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  const n = visible.length;
  let scale = 0.2;
  for (let c = 1; c <= n; c++) {
    const rows = Math.ceil(n / c);
    const s = Math.min((box.w - (c - 1) * GAP) / (c * PHONE.width), (box.h - (rows - 1) * GAP - rows * CAPTION) / (rows * PHONE.height));
    scale = Math.max(scale, s);
  }
  scale = clamp(scale, 0.2, focused ? 1.25 : 1);

  return (
    <div className="social-phones" ref={ref}>
      <ScaleCtx.Provider value={scale}>
        {visible.map((pl) => (
          <Phone key={pl.id} platform={pl} scale={scale} onSelect={focused ? undefined : () => onSelect(pl.id)}>
            <ScreenFor id={pl.id} post={post} />
          </Phone>
        ))}
      </ScaleCtx.Provider>
    </div>
  );
}

function Phone({ platform, scale, onSelect, children }: { platform: Platform; scale: number; onSelect?: () => void; children: React.ReactNode }) {
  return (
    <figure className={cx('sv-figure', onSelect && 'selectable')} style={{ width: PHONE.width * scale }}>
      <div
        className="sv-box"
        style={{ width: PHONE.width * scale, height: PHONE.height * scale }}
        onClick={onSelect}
        role={onSelect ? 'button' : undefined}
        tabIndex={onSelect ? 0 : undefined}
        aria-label={onSelect ? `View ${platform.network} ${platform.name} larger` : undefined}
        onKeyDown={(e) => onSelect && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect())}
      >
        <div className="sv-phone" style={{ transform: `scale(${scale})` }}>
          <div className={cx('sv-screen', platform.id)}>
            {children}
            <StatusBar />
            <span className="sv-home" />
          </div>
          <span className="sv-island" />
        </div>
      </div>
      <figcaption>
        <b>
          {platform.network} · {platform.name}
        </b>
        <span>{platform.format}</span>
      </figcaption>
    </figure>
  );
}

function StatusBar() {
  return (
    <div className="sv-status" aria-hidden>
      <span>9:41</span>
      <span className="sv-status-icons">
        <Signal size={14} strokeWidth={2.6} />
        <Wifi size={14} strokeWidth={2.6} />
        <BatteryFull size={18} strokeWidth={2} />
      </span>
    </div>
  );
}

function ScreenFor({ id, post }: { id: PlatformId; post: Post }) {
  switch (id) {
    case 'ig-reels':
      return <ReelsIG post={post} />;
    case 'tiktok':
      return <TikTok post={post} />;
    case 'shorts':
      return <Shorts post={post} />;
    case 'fb-reels':
      return <ReelsFB post={post} />;
    case 'ig-story':
      return <StoryIG post={post} />;
    case 'ig-feed':
      return <FeedIG post={post} />;
    case 'ig-profile':
      return <ProfileIG post={post} />;
    case 'fb-feed':
      return <FeedFB post={post} />;
  }
}

// ---------------------------------------------------------------- shared pieces

function Avatar({ post, size }: { post: Post; size: number }) {
  return (
    <span className="sv-avatar" style={{ width: size, height: size }}>
      {post.avatar ? <img src={post.avatar} alt="" /> : <span>{post.account.slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}

function Action({ icon, text }: { icon: React.ReactNode; text?: string }) {
  return (
    <span className="sv-action">
      {icon}
      {text && <small>{text}</small>}
    </span>
  );
}

/** Brand safe zone (BRAND.md) over a 9:16 frame. */
function BrandZone() {
  const z = SAFE_ZONES.find((x: { id: string }) => x.id === 'brand') as { ref: { width: number; height: number }; safe: { x: number; y: number; w: number; h: number } };
  const { width, height } = z.ref;
  const s = z.safe;
  return (
    <svg className="sv-zone" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      <path d={`M0 0H${width}V${height}H0Z M${s.x} ${s.y}V${s.y + s.h}H${s.x + s.w}V${s.y}Z`} fillRule="evenodd" />
      <rect x={s.x} y={s.y} width={s.w} height={s.h} />
    </svg>
  );
}

/** The 9:16 frame of the full-screen views. */
function Media916({ post, children, rounded }: { post: Post; children?: React.ReactNode; rounded?: boolean }) {
  return (
    <div className={cx('sv-media', rounded && 'round')} style={{ top: STATUS_BAR, height: HEIGHT_916 }}>
      <Canvas fit={close(post.r, 9 / 16) ? 'cover' : 'contain'} height={HEIGHT_916} />
      {post.zones && <BrandZone />}
      {post.ui && (
        <div className="sv-layer">
          <span className="sv-gradient" />
          {children}
        </div>
      )}
    </div>
  );
}

function Caption({ post, lines = 1, more = 'more' }: { post: Post; lines?: number; more?: string }) {
  return (
    <p className={cx('sv-text', lines > 1 && 'two')}>
      {post.text || ' '}
      {post.text.length > 40 && <span className="sv-more"> … {more}</span>}
    </p>
  );
}

function NavIG({ active }: { active: 'home' | 'reels' | 'profile' }) {
  return (
    <nav className="sv-nav" aria-hidden>
      <House size={24} strokeWidth={active === 'home' ? 2.6 : 1.8} />
      <Search size={24} />
      <SquarePlus size={24} />
      <Clapperboard size={24} strokeWidth={active === 'reels' ? 2.6 : 1.8} />
      <CircleUserRound size={24} strokeWidth={active === 'profile' ? 2.6 : 1.8} />
    </nav>
  );
}

// ---------------------------------------------------------------- screens

function ReelsIG({ post }: { post: Post }) {
  return (
    <>
      <Media916 post={post}>
        <div className="sv-top">
          <b className="sv-title">
            Reels <ChevronDown size={16} />
          </b>
          <Camera size={24} />
        </div>
        <div className="sv-column">
          <Action icon={<Heart size={26} />} text="1,248" />
          <Action icon={<MessageCircle size={26} />} text="86" />
          <Action icon={<Send size={25} />} text="32" />
          <Action icon={<Ellipsis size={24} />} />
          <span className="sv-disc square">
            <Avatar post={post} size={26} />
          </span>
        </div>
        <div className="sv-bottom">
          <div className="sv-author">
            <Avatar post={post} size={30} />
            <b>{post.account}</b>
            <span className="sv-btn-outline">Follow</span>
          </div>
          <Caption post={post} />
          <p className="sv-audio">
            <Music2 size={12} /> {post.account} · Original audio
          </p>
        </div>
      </Media916>
      {post.ui && <NavIG active="reels" />}
    </>
  );
}

function TikTok({ post }: { post: Post }) {
  return (
    <>
      <Media916 post={post}>
        <div className="sv-top centered">
          <span className="sv-tabs">
            <span>Following</span>
            <b>For You</b>
          </span>
          <Search size={22} className="sv-right" />
        </div>
        <div className="sv-column">
          <span className="sv-profile-tt">
            <Avatar post={post} size={42} />
            <span className="sv-more-tt">
              <Plus size={11} strokeWidth={3} />
            </span>
          </span>
          <Action icon={<Heart size={30} fill="currentColor" strokeWidth={0} />} text="12.4K" />
          <Action icon={<MessageCircleMore size={29} fill="currentColor" stroke="#000" strokeWidth={1.4} />} text="318" />
          <Action icon={<Bookmark size={27} fill="currentColor" strokeWidth={0} />} text="1,024" />
          <Action icon={<Forward size={29} fill="currentColor" strokeWidth={0} />} text="96" />
          <span className="sv-disc">
            <Avatar post={post} size={22} />
          </span>
        </div>
        <div className="sv-bottom wide-tt">
          <b className="sv-account-tt">{post.account}</b>
          <Caption post={post} lines={2} />
          <p className="sv-audio">
            <Music2 size={12} /> original sound · {post.account}
          </p>
        </div>
      </Media916>
      {post.ui && (
        <nav className="sv-nav with-text" aria-hidden>
          <span>
            <House size={22} strokeWidth={2.4} />
            Home
          </span>
          <span>
            <Users size={22} />
            Friends
          </span>
          <span className="sv-create-tt">
            <Plus size={18} strokeWidth={3} />
          </span>
          <span>
            <Inbox size={22} />
            Inbox
          </span>
          <span>
            <UserRound size={22} />
            Profile
          </span>
        </nav>
      )}
    </>
  );
}

function Shorts({ post }: { post: Post }) {
  return (
    <>
      <Media916 post={post}>
        <div className="sv-top">
          <span />
          <span className="sv-icons">
            <Search size={22} />
            <EllipsisVertical size={22} />
          </span>
        </div>
        <div className="sv-column">
          <Action icon={<ThumbsUp size={26} fill="currentColor" strokeWidth={0} />} text="1.2K" />
          <Action icon={<ThumbsDown size={26} fill="currentColor" strokeWidth={0} />} text="Dislike" />
          <Action icon={<MessageSquareText size={26} fill="currentColor" stroke="#000" strokeWidth={1.4} />} text="86" />
          <Action icon={<Forward size={26} fill="currentColor" strokeWidth={0} />} text="Share" />
          <Action icon={<Repeat2 size={26} />} text="Remix" />
          <span className="sv-disc square">
            <Avatar post={post} size={26} />
          </span>
        </div>
        <div className="sv-bottom">
          <Caption post={post} lines={2} />
          <div className="sv-author">
            <Avatar post={post} size={28} />
            <b>@{post.account}</b>
            <span className="sv-btn-filled">Subscribe</span>
          </div>
          <p className="sv-audio">
            <Music2 size={12} /> {post.account} · Original sound
          </p>
        </div>
      </Media916>
      {post.ui && (
        <nav className="sv-nav with-text" aria-hidden>
          <span>
            <House size={22} />
            Home
          </span>
          <span>
            <SquarePlay size={22} strokeWidth={2.4} />
            Shorts
          </span>
          <span>
            <CirclePlus size={34} strokeWidth={1.3} />
          </span>
          <span>
            <Clapperboard size={22} />
            Subscriptions
          </span>
          <span>
            <CircleUserRound size={22} />
            You
          </span>
        </nav>
      )}
    </>
  );
}

function ReelsFB({ post }: { post: Post }) {
  return (
    <>
      <Media916 post={post}>
        <div className="sv-top">
          <b className="sv-title">Reels</b>
          <span className="sv-icons">
            <Search size={22} />
            <CircleUserRound size={22} />
          </span>
        </div>
        <div className="sv-column">
          <Action icon={<ThumbsUp size={26} />} text="856" />
          <Action icon={<MessageCircle size={26} />} text="42" />
          <Action icon={<Forward size={26} />} text="18" />
          <Action icon={<Ellipsis size={24} />} />
        </div>
        <div className="sv-bottom">
          <div className="sv-author">
            <Avatar post={post} size={30} />
            <b>{post.name}</b>
            <span className="sv-dim">· Follow</span>
          </div>
          <Caption post={post} lines={2} more="See more" />
          <p className="sv-audio">
            <Music2 size={12} /> {post.account} · Original audio · <Globe size={11} /> Public
          </p>
        </div>
      </Media916>
      {post.ui && (
        <nav className="sv-nav" aria-hidden>
          <House size={23} />
          <Clapperboard size={23} strokeWidth={2.6} />
          <Users size={23} />
          <Store size={23} />
          <Bell size={23} />
          <Menu size={23} />
        </nav>
      )}
    </>
  );
}

function StoryIG({ post }: { post: Post }) {
  const mirror = useContext(MirrorCtx)!;
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      mirror.onProgress((t, d) => {
        if (bar.current) bar.current.style.width = `${d ? (t / d) * 100 : 0}%`;
      }),
    [mirror],
  );
  return (
    <>
      <Media916 post={post} rounded>
        <div className="sv-story-top">
          <div className="sv-progress">
            <span>
              <span ref={bar} style={{ width: post.isVideo ? 0 : '35%' }} />
            </span>
            <span />
            <span />
          </div>
          <div className="sv-author">
            <Avatar post={post} size={30} />
            <b>{post.account}</b>
            <span className="sv-dim">2h</span>
            <span className="sv-icons sv-right">
              <Ellipsis size={20} />
              <X size={22} />
            </span>
          </div>
        </div>
      </Media916>
      {post.ui && (
        <div className="sv-message" aria-hidden>
          <span className="sv-field">Send message</span>
          <Heart size={24} />
          <Send size={23} />
        </div>
      )}
    </>
  );
}

/** Height of the piece inside a feed (from 4:5 to 1.91:1). */
const feedHeight = (r: number) => Math.round(SCREEN.width / clamp(r, 0.8, 1.91));

function CarouselDots({ post }: { post: Post }) {
  if (post.pages < 2) return null;
  return (
    <span className="sv-dots" aria-hidden>
      {Array.from({ length: Math.min(post.pages, 10) }, (_, i) => (
        <span key={i} className={cx(i === post.page && 'is-active')} />
      ))}
    </span>
  );
}

function FeedIG({ post }: { post: Post }) {
  const height = feedHeight(post.r);
  return (
    <div className="sv-scrollable" style={{ top: STATUS_BAR }}>
      {post.ui && (
        <div className="sv-app-bar">
          <b className="sv-title large">
            For you <ChevronDown size={16} />
          </b>
          <span className="sv-icons">
            <Heart size={24} />
            <Send size={23} />
          </span>
        </div>
      )}
      {post.ui && (
        <div className="sv-post-head">
          <Avatar post={post} size={32} />
          <span className="sv-post-who">
            <b>{post.account}</b>
            {post.isVideo && <small>Original audio</small>}
          </span>
          <Ellipsis size={20} />
        </div>
      )}
      <div className="sv-media-feed" style={{ height }}>
        <Canvas fit="cover" height={height} />
        {post.ui && post.pages > 1 && (
          <span className="sv-chip">
            {post.page + 1}/{post.pages}
          </span>
        )}
        {post.ui && post.isVideo && (
          <span className="sv-chip bottom">
            <VolumeX size={13} />
          </span>
        )}
      </div>
      {post.ui && (
        <>
          <div className="sv-actions">
            <Heart size={25} />
            <MessageCircle size={25} />
            <Send size={24} />
            <CarouselDots post={post} />
            <Bookmark size={25} className="sv-right" />
          </div>
          <p className="sv-line">
            <b>1,248 likes</b>
          </p>
          <p className="sv-line sv-caption">
            <b>{post.account}</b> {post.text}
          </p>
          <p className="sv-line sv-dim">View all 86 comments</p>
          <p className="sv-line sv-dim small">2 hours ago</p>
        </>
      )}
      {post.ui && <NavIG active="home" />}
    </div>
  );
}

function ProfileIG({ post }: { post: Post }) {
  const side = (SCREEN.width - 2) / 3;
  const height = Math.round((side * 4) / 3);
  const filler = Array.from({ length: Math.max(0, 8 - post.others.length) });
  return (
    <div className="sv-scrollable" style={{ top: STATUS_BAR }}>
      <div className="sv-app-bar">
        <b className="sv-title large">
          {post.account} <ChevronDown size={16} />
        </b>
        <span className="sv-icons">
          <SquarePlus size={24} />
          <Menu size={24} />
        </span>
      </div>
      <div className="sv-profile">
        <Avatar post={post} size={78} />
        <span>
          <b>48</b>posts
        </span>
        <span>
          <b>1,204</b>followers
        </span>
        <span>
          <b>180</b>following
        </span>
      </div>
      <p className="sv-line">
        <b>{post.name}</b>
      </p>
      <div className="sv-profile-buttons">
        <span>Edit profile</span>
        <span>Share profile</span>
      </div>
      <div className="sv-profile-tabs">
        <Grid3x3 size={22} />
        <Clapperboard size={22} />
        <SquareUser size={22} />
      </div>
      <div className="sv-grid" style={{ gridAutoRows: height }}>
        <span className="sv-tile own">
          <Canvas fit="cover" height={height} />
          {post.isVideo ? <Clapperboard size={15} className="sv-tile-mark" /> : post.pages > 1 ? <Images size={15} className="sv-tile-mark" /> : null}
        </span>
        {post.others.slice(0, 8).map((url, i) => (
          <span key={i} className="sv-tile">
            <img src={url} alt="" loading="lazy" />
          </span>
        ))}
        {filler.map((_, i) => (
          <span key={`v${i}`} className="sv-tile is-empty" />
        ))}
      </div>
      <NavIG active="profile" />
    </div>
  );
}

function FeedFB({ post }: { post: Post }) {
  const height = feedHeight(post.r);
  return (
    <div className="sv-scrollable light-fb" style={{ top: STATUS_BAR }}>
      {post.ui && (
        <div className="sv-app-bar">
          <b className="sv-title large">Home</b>
          <span className="sv-icons">
            <CirclePlus size={24} />
            <Search size={23} />
            <MessageCircle size={23} />
          </span>
        </div>
      )}
      {post.ui && (
        <>
          <div className="sv-post-head">
            <Avatar post={post} size={38} />
            <span className="sv-post-who">
              <b>{post.name}</b>
              <small>
                Just now · <Globe size={10} />
              </small>
            </span>
            <Ellipsis size={20} />
            <X size={20} />
          </div>
          <p className="sv-line sv-caption three">{post.text}</p>
        </>
      )}
      <div className="sv-media-feed" style={{ height }}>
        <Canvas fit="cover" height={height} />
      </div>
      {post.ui && (
        <>
          <div className="sv-reactions">
            <span>
              <span className="sv-reaction">
                <ThumbsUp size={10} fill="currentColor" strokeWidth={0} />
              </span>
              128
            </span>
            <span>12 comments · 3 shares</span>
          </div>
          <div className="sv-actions-fb">
            <span>
              <ThumbsUp size={18} /> Like
            </span>
            <span>
              <MessageCircle size={18} /> Comment
            </span>
            <span>
              <Forward size={18} /> Share
            </span>
          </div>
          <nav className="sv-nav" aria-hidden>
            <House size={23} strokeWidth={2.6} />
            <Clapperboard size={23} />
            <Users size={23} />
            <Store size={23} />
            <Bell size={23} />
            <Menu size={23} />
          </nav>
        </>
      )}
    </div>
  );
}
