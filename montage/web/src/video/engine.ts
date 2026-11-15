// Preview engine of the video editor (WebCodecs via mediabunny).
// - Master clock: AudioContext. Audio is scheduled with sample accuracy.
// - Each video clip has its own decoder (CanvasSink) and a reader with frames buffered ahead;
//   the next clip is preloaded 1 s before the cut so there are no jumps.
// - While paused, frames are requested coalesced (only the latest target), same as in review.

import { ALL_FORMATS, BlobSource, CanvasSink, Input, type WrappedCanvas } from 'mediabunny';
import { rasterKey } from '../../../shared/hash.js';
import { renderLayer } from '../image/render';
import { clock } from '../clock';
import type { Media } from '../types';
import { repoUrl } from '../api';
import { timelineDuration, end, fade, type LayerClip, type VideoClip, type Timeline } from './model';

class Reader {
  current: WrappedCanvas | null = null;
  private queue: WrappedCanvas[] = [];
  private iter: AsyncGenerator<WrappedCanvas, void, unknown>;
  private fetching = false;
  private finished = false;
  private closed = false;

  constructor(sink: CanvasSink, from: number) {
    this.iter = sink.canvases(Math.max(0, from));
    this.fill();
  }

  private async fill() {
    if (this.fetching || this.finished || this.closed) return;
    this.fetching = true;
    try {
      while (!this.closed && this.queue.length < 2) {
        const r = await this.iter.next();
        if (r.done) {
          this.finished = true;
          break;
        }
        if (!this.current) this.current = r.value;
        else this.queue.push(r.value);
      }
    } catch {
      this.finished = true;
    } finally {
      this.fetching = false;
    }
  }

  frame(st: number) {
    while (this.queue.length && this.queue[0].timestamp <= st + 1e-4) this.current = this.queue.shift()!;
    this.fill();
    return this.current;
  }

  close() {
    this.closed = true;
    this.iter.return(undefined).catch(() => {});
  }
}

interface Source {
  input: Input;
  blob: Blob;
}

export class Engine {
  canvas: HTMLCanvasElement | null = null;
  tl: Timeline;
  media = new Map<string, Media>();
  t = 0;
  playing = false;
  onChange?: (playing: boolean) => void;

  private sources = new Map<string, Promise<Source | null>>();
  private sinks = new Map<string, Promise<CanvasSink | null>>();
  private readers = new Map<string, Reader | 'loading'>();
  private stills = new Map<string, WrappedCanvas>();
  private requests = new Map<string, { seeking: boolean; target: number | null }>();
  private rasters = new Map<string, { canvas: HTMLCanvasElement; key: string; scale: number }>();
  private images = new Map<string, HTMLImageElement>();
  private audio: AudioContext | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private sounding: AudioBufferSourceNode[] = [];
  private t0 = 0;
  private a0 = 0;
  private raf = 0;
  private generation = 0;

  constructor(tl: Timeline) {
    this.tl = tl;
    document.fonts?.addEventListener?.('loadingdone', this.onFontsLoaded);
  }

  get duration() {
    return timelineDuration(this.tl);
  }

  attach(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.draw();
  }

  setMedia(media: Map<string, Media>) {
    this.media = media;
    for (const path of new Set(this.tl.clips.flatMap((c) => ('path' in c ? [c.path] : [])))) {
      if (media.get(path)?.urls.audio) this.buffer(path);
    }
    if (!this.playing) this.pausedFrames();
  }

  setTimeline(tl: Timeline) {
    this.tl = tl;
    if (this.playing) {
      // The edit changed while playing: restart from the same point.
      this.stop();
      this.play();
    } else this.pausedFrames();
  }

  // ----- transport

  async play() {
    if (this.playing || !this.tl.clips.length) return;
    if (this.t >= this.duration - 1e-3) this.t = 0;
    const ctx = this.audioContext();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    this.playing = true;
    const gen = ++this.generation;
    this.t0 = this.t;
    this.a0 = ctx.currentTime + 0.05;
    this.scheduleAudio(gen);
    this.onChange?.(true);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.step);
  }

  pause() {
    if (!this.playing) return;
    this.stop();
    clock.set(this.t);
    this.pausedFrames();
    this.onChange?.(false);
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t: number) {
    const fps = this.tl.format.fps;
    t = Math.max(0, Math.min(Math.max(0, this.duration - 1 / fps), t));
    if (this.playing) {
      this.stop();
      this.t = t;
      clock.set(t);
      this.play();
      return;
    }
    this.t = t;
    clock.set(t);
    this.pausedFrames();
  }

  private stop() {
    this.playing = false;
    this.generation++;
    cancelAnimationFrame(this.raf);
    for (const s of this.sounding) {
      try {
        s.stop();
      } catch {}
    }
    this.sounding = [];
    for (const r of this.readers.values()) if (r !== 'loading') r.close();
    this.readers.clear();
  }

  private step = () => {
    if (!this.playing || !this.audio) return;
    const t = this.t0 + Math.max(0, this.audio.currentTime - this.a0);
    if (t >= this.duration) {
      this.t = this.duration;
      this.stop();
      clock.set(this.t);
      this.pausedFrames();
      this.onChange?.(false);
      return;
    }
    this.t = t;
    this.updateReaders(t);
    this.draw();
    clock.set(t);
    this.raf = requestAnimationFrame(this.step);
  };

  // ----- video

  private source(path: string) {
    let p = this.sources.get(path);
    if (p) return p;
    const url = this.media.get(path)?.urls.preview;
    if (!url) return Promise.resolve(null);
    p = (async () => {
      try {
        const blob = await (await fetch(url)).blob();
        return { input: new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) }), blob };
      } catch {
        return null;
      }
    })();
    this.sources.set(path, p);
    return p;
  }

  /** One decoder per clip: that way two clips of the same media do not step on each other's frames. */
  private sink(c: VideoClip) {
    let p = this.sinks.get(c.id);
    if (p) return p;
    p = (async () => {
      const s = await this.source(c.path);
      if (!s) {
        this.sinks.delete(c.id);
        return null;
      }
      const track = await s.input.getPrimaryVideoTrack();
      if (!track || !(await track.canDecode())) return null;
      return new CanvasSink(track, { poolSize: 10 });
    })();
    this.sinks.set(c.id, p);
    return p;
  }

  private visibleClips() {
    const tracks = this.tl.tracks.filter((p) => p.type === 'video' && !p.hidden).map((p) => p.id);
    return this.tl.clips.filter((c) => tracks.includes(c.track));
  }

  private updateReaders(t: number) {
    for (const c of this.visibleClips()) {
      if (c.type !== 'video') continue;
      const active = t >= c.start - 1 && t < end(c);
      const r = this.readers.get(c.id);
      if (active && !r) {
        this.readers.set(c.id, 'loading');
        const from = c.sourceIn + Math.max(0, t - c.start) * c.speed;
        const gen = this.generation;
        this.sink(c).then((s) => {
          if (gen !== this.generation || !s) return void this.readers.delete(c.id);
          this.readers.set(c.id, new Reader(s, from));
        });
      } else if (!active && r) {
        if (r !== 'loading') r.close();
        this.readers.delete(c.id);
      }
    }
  }

  /** While paused: requests the exact frame of each visible clip (coalesced). */
  private pausedFrames() {
    const t = this.t;
    for (const c of this.visibleClips()) {
      if (c.type !== 'video' || t < c.start || t >= end(c)) continue;
      this.requestFrame(c, c.sourceIn + (t - c.start) * c.speed);
    }
    this.draw();
  }

  private requestFrame(c: VideoClip, st: number) {
    let p = this.requests.get(c.id);
    if (!p) {
      p = { seeking: false, target: null };
      this.requests.set(c.id, p);
    }
    if (p.seeking) {
      p.target = st;
      return;
    }
    p.seeking = true;
    const request = p;
    (async () => {
      let goal: number | null = st;
      while (goal !== null) {
        const s = await this.sink(c);
        const w = s ? await s.getCanvas(goal).catch(() => null) : null;
        if (w) {
          this.stills.set(c.id, w);
          if (!this.playing) this.draw();
        }
        goal = request.target;
        request.target = null;
      }
      request.seeking = false;
    })();
  }

  // ----- compositing

  draw() {
    const cv = this.canvas;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const { width: W } = this.tl.format;
    const e = cv.width / W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.tl.background || '#000';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const t = this.t;
    const order = this.tl.tracks.filter((p) => p.type === 'video' && !p.hidden).reverse();
    for (const p of order) {
      for (const c of this.tl.clips) {
        if (c.track !== p.id || t < c.start || t >= end(c) || c.type === 'audio') continue;
        const alpha = c.opacity * fade(c, t);
        if (alpha <= 0) continue;
        if (c.type === 'video') {
          const st = c.sourceIn + (t - c.start) * c.speed;
          const r = this.readers.get(c.id);
          const w = this.playing && r && r !== 'loading' ? r.frame(st) : this.stills.get(c.id);
          if (w) this.drawVideo(ctx, w.canvas, c, e, alpha);
        } else {
          const r = this.raster(c, e);
          if (r) {
            ctx.globalAlpha = alpha;
            ctx.drawImage(r, 0, 0, cv.width, cv.height);
            ctx.globalAlpha = 1;
          }
        }
      }
    }
  }

  private drawVideo(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, c: VideoClip, e: number, alpha: number) {
    const { width: W, height: H } = this.tl.format;
    const meta = this.media.get(c.path)?.meta;
    const sw = meta?.width || img.width;
    const sh = meta?.height || img.height;
    const tr = c.transform;
    const fit = tr.fit === 'cover' ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
    const s = fit * tr.scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.scale(e, e);
    ctx.translate(W / 2 + tr.x, H / 2 + tr.y);
    if (tr.rotation) ctx.rotate((tr.rotation * Math.PI) / 180);
    ctx.drawImage(img, (-sw * s) / 2, (-sh * s) / 2, sw * s, sh * s);
    ctx.restore();
  }

  private raster(c: LayerClip, e: number) {
    const key = rasterKey(c, this.tl.format);
    const r = this.rasters.get(c.id);
    if (r && r.key === key && Math.abs(r.scale - e) < 1e-3) return r.canvas;
    if (c.layer.type === 'image') {
      const path = c.layer.path;
      const img = this.images.get(path);
      if (!img) {
        const fresh = new Image();
        fresh.onload = () => this.draw();
        fresh.src = repoUrl(path);
        this.images.set(path, fresh);
        return null;
      }
      if (!img.complete) return null;
    }
    const canvas = r?.canvas ?? document.createElement('canvas');
    renderLayer(canvas, c.layer, this.tl.format, e, this.images);
    this.rasters.set(c.id, { canvas, key, scale: e });
    return canvas;
  }

  private onFontsLoaded = () => {
    this.rasters.clear();
    this.draw();
  };

  // ----- audio

  private audioContext() {
    if (!this.audio) this.audio = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
    return this.audio;
  }

  private buffer(path: string) {
    let p = this.buffers.get(path);
    if (p) return p;
    const url = this.media.get(path)?.urls.audio;
    if (!url) return Promise.resolve(null);
    p = (async () => {
      try {
        const data = await (await fetch(url)).arrayBuffer();
        return await this.audioContext().decodeAudioData(data);
      } catch {
        return null;
      }
    })();
    this.buffers.set(path, p);
    return p;
  }

  private async scheduleAudio(gen: number) {
    const ctx = this.audioContext();
    for (const c of this.tl.clips) {
      if (c.type !== 'audio' && !(c.type === 'video' && c.hasAudio)) continue;
      const track = this.tl.tracks.find((p) => p.id === c.track);
      if (!track || track.muted || c.volume <= 0 || end(c) <= this.t0) continue;
      const buf = await this.buffer(c.path);
      if (!buf || gen !== this.generation) continue;
      const from = Math.max(c.start, this.t0);
      const when = this.a0 + (from - this.t0);
      // If the audio took a while to decode, it starts further into the file.
      const delay = Math.max(0, ctx.currentTime - when);
      const offset = c.sourceIn + (from - c.start) * c.speed + delay * c.speed;
      const dur = (end(c) - from - delay) * c.speed;
      if (offset >= buf.duration || dur <= 0) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = c.speed;
      const g = ctx.createGain();
      const startAt = when + delay;
      const tAt = (tl: number) => startAt + (tl - (from + delay));
      g.gain.setValueAtTime(c.volume * fade(c, from + delay), startAt);
      if (c.fadeIn > 0 && from + delay < c.start + c.fadeIn) g.gain.linearRampToValueAtTime(c.volume, tAt(c.start + c.fadeIn));
      if (c.fadeOut > 0) {
        const rampFrom = Math.max(from + delay, end(c) - c.fadeOut);
        g.gain.setValueAtTime(c.volume * fade(c, rampFrom), tAt(rampFrom));
        g.gain.linearRampToValueAtTime(0, tAt(end(c)));
      }
      src.connect(g).connect(ctx.destination);
      src.start(startAt, offset, dur);
      this.sounding.push(src);
    }
  }

  destroy() {
    this.stop();
    document.fonts?.removeEventListener?.('loadingdone', this.onFontsLoaded);
    for (const p of this.sources.values()) p.then((s) => s?.input.dispose()).catch(() => {});
    this.audio?.close().catch(() => {});
  }
}
