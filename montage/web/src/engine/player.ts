// Control of the review <video>. Keys to smoothness:
// - seeks are never queued: if one is in progress, only the last target is kept;
// - the playhead and the timecode live in `clock` (outside React);
// - to show frame n we seek to (n + 0.5) / fps.

import { createContext, useContext } from 'react';
import { frameAt, frameMid } from '../../../shared/time.js';
import { setStore, getStore } from '../state';
import { clock } from '../clock';

export class Player {
  video: HTMLVideoElement | null = null;
  secondary: HTMLVideoElement | null = null;
  fps = 30;
  duration = 0;
  private seeking = false;
  private target: number | null = null;
  private seekingSec = false;
  private targetSec: number | null = null;
  private raf = 0;
  private reverse = 0;
  private lastRaf = 0;

  attach(video: HTMLVideoElement | null) {
    if (this.video === video) return;
    const v0 = this.video;
    if (v0) {
      v0.removeEventListener('seeked', this.onSeeked);
      v0.removeEventListener('play', this.onPlay);
      v0.removeEventListener('pause', this.onPause);
      v0.removeEventListener('loadedmetadata', this.onLoaded);
      v0.removeEventListener('emptied', this.onEmptied);
      v0.removeEventListener('ended', this.onEnded);
    }
    this.video = video;
    this.seeking = false;
    this.target = null;
    if (video) {
      video.addEventListener('seeked', this.onSeeked);
      video.addEventListener('play', this.onPlay);
      video.addEventListener('pause', this.onPause);
      video.addEventListener('loadedmetadata', this.onLoaded);
      video.addEventListener('emptied', this.onEmptied);
      video.addEventListener('ended', this.onEnded);
    }
  }

  attachSecondary(video: HTMLVideoElement | null) {
    const s0 = this.secondary;
    if (s0) {
      s0.removeEventListener('seeked', this.onSeekedSec);
      s0.removeEventListener('loadedmetadata', this.onLoadedSec);
      s0.removeEventListener('emptied', this.onEmptiedSec);
    }
    this.secondary = video;
    this.seekingSec = false;
    this.targetSec = null;
    if (video) {
      video.muted = true;
      video.addEventListener('seeked', this.onSeekedSec);
      video.addEventListener('loadedmetadata', this.onLoadedSec);
      video.addEventListener('emptied', this.onEmptiedSec);
      if (video.readyState >= 1) this.syncSecondary(true);
    }
  }

  configure(fps: number | undefined, duration: number | undefined) {
    this.fps = fps || 30;
    this.duration = duration || 0;
  }

  get totalFrames() {
    return Math.max(1, Math.round(this.duration * this.fps));
  }

  get frame() {
    return Math.min(this.totalFrames - 1, frameAt(clock.t, this.fps));
  }

  get playing() {
    return (!!this.video && !this.video.paused) || this.reverse !== 0;
  }

  private range() {
    const { markIn, markOut, loop } = getStore();
    if (!loop || markIn === null || markOut === null || markOut <= markIn) return null;
    return { a: markIn / this.fps, b: markOut / this.fps };
  }

  play() {
    const v = this.video;
    if (!v) return;
    this.stopReverse();
    const r = this.range();
    if (r && (clock.t < r.a || clock.t >= r.b - 1e-3)) this.seek(r.a);
    else if (clock.t >= this.duration - 1.5 / this.fps) this.seek(0);
    v.playbackRate = getStore().speed;
    v.play().catch(() => {});
  }

  pause() {
    this.stopReverse();
    if (this.video && !this.video.paused) this.video.pause();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t: number) {
    const max = this.duration > 0 ? this.duration - 0.5 / this.fps : t;
    t = Math.max(0, Math.min(max, t));
    clock.set(t);
    const v = this.video;
    if (!v || v.readyState < 1) {
      this.target = t;
      return;
    }
    if (this.seeking) {
      this.target = t;
    } else {
      this.seeking = true;
      v.currentTime = t;
    }
    this.seekSecondary(t);
  }

  goToFrame(n: number) {
    n = Math.max(0, Math.min(this.totalFrames - 1, Math.round(n)));
    this.seek(frameMid(n, this.fps));
  }

  step(d: number) {
    this.pause();
    this.goToFrame(this.frame + d);
  }

  jump(seconds: number) {
    this.goToFrame(this.frame + Math.round(seconds * this.fps));
  }

  goToStart() {
    this.goToFrame(0);
  }

  goToEnd() {
    this.pause();
    this.goToFrame(this.totalFrames - 1);
  }

  setSpeed(r: number) {
    setStore({ speed: r });
    if (this.video) this.video.playbackRate = r;
    if (this.secondary) this.secondary.playbackRate = r;
  }

  /** J: play backwards (with coalesced seeks). Each press doubles the speed. */
  backward() {
    if (this.video && !this.video.paused) this.video.pause();
    this.reverse = this.reverse ? Math.min(8, this.reverse * 2) : 1;
    setStore({ playing: true });
    this.lastRaf = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.reverseStep);
  }

  /** L: play; if already playing, speed up (1×, 2×, 4×). */
  forward() {
    if (this.reverse) this.stopReverse();
    if (this.video && !this.video.paused) this.setSpeed(Math.min(4, getStore().speed * 2));
    else {
      this.setSpeed(1);
      this.play();
    }
  }

  private stopReverse() {
    if (!this.reverse) return;
    this.reverse = 0;
    cancelAnimationFrame(this.raf);
    setStore({ playing: false });
    this.goToFrame(this.frame);
  }

  private reverseStep = (now: number) => {
    if (!this.reverse) return;
    const dt = (now - this.lastRaf) / 1000;
    this.lastRaf = now;
    const t = clock.t - dt * this.reverse;
    if (t <= 0) {
      this.seek(0);
      this.stopReverse();
      return;
    }
    this.seek(t);
    this.raf = requestAnimationFrame(this.reverseStep);
  };

  private tick = () => {
    const v = this.video;
    if (!v || v.paused) return;
    let t = v.currentTime;
    const r = this.range();
    if (r && t >= r.b) {
      v.currentTime = r.a;
      t = r.a;
    }
    clock.set(t);
    this.syncSecondary(false);
    this.raf = requestAnimationFrame(this.tick);
  };

  private onSeeked = () => {
    const v = this.video;
    if (!v) return;
    if (this.target !== null) {
      const t = this.target;
      this.target = null;
      v.currentTime = t;
      return;
    }
    this.seeking = false;
  };

  private onPlay = () => {
    setStore({ playing: true });
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
    this.syncSecondary(true);
  };

  private onPause = () => {
    if (this.reverse) return;
    cancelAnimationFrame(this.raf);
    setStore({ playing: false });
    if (this.video && !this.seeking) clock.set(this.video.currentTime);
    if (this.secondary && !this.secondary.paused) this.secondary.pause();
    this.seekSecondary(clock.t);
  };

  private onEnded = () => {
    setStore({ playing: false });
  };

  /**
   * When the source changes (another version or the proxy just ready) the time is kept.
   * The clock is the only truth: `seek` always sets it before touching the video.
   */
  private onLoaded = () => {
    const v = this.video;
    if (!v) return;
    v.playbackRate = getStore().speed;
    this.target = null;
    this.seeking = true;
    v.currentTime = Math.min(clock.t, Math.max(0, (v.duration || clock.t) - 0.5 / this.fps));
  };

  /** A new source aborts the seek in progress (its 'seeked' never arrives). */
  private onEmptied = () => {
    this.seeking = false;
    this.target = null;
  };

  private onLoadedSec = () => {
    this.seekingSec = false;
    this.targetSec = null;
    this.syncSecondary(true);
  };

  private onEmptiedSec = () => {
    this.seekingSec = false;
    this.targetSec = null;
  };

  // ----- secondary video (compare)

  private seekSecondary(t: number) {
    const s = this.secondary;
    if (!s || s.readyState < 1) return;
    const goal = Math.min(t, Math.max(0, (s.duration || t) - 0.02));
    if (this.seekingSec) {
      this.targetSec = goal;
      return;
    }
    this.seekingSec = true;
    s.currentTime = goal;
  }

  private onSeekedSec = () => {
    const s = this.secondary;
    if (!s) return;
    if (this.targetSec !== null) {
      const t = this.targetSec;
      this.targetSec = null;
      s.currentTime = t;
      return;
    }
    this.seekingSec = false;
  };

  syncSecondary(force: boolean) {
    const s = this.secondary;
    const v = this.video;
    if (!s || !v || s.readyState < 1) return;
    s.playbackRate = v.playbackRate;
    if (v.paused) {
      if (!s.paused) s.pause();
      if (force) this.seekSecondary(clock.t);
      return;
    }
    const t = v.currentTime;
    if (t >= (s.duration || Infinity)) {
      if (!s.paused) s.pause();
      return;
    }
    if (force || Math.abs(s.currentTime - t) > 0.08) s.currentTime = t;
    if (s.paused) s.play().catch(() => {});
  }
}

export const PlayerContext = createContext<Player | null>(null);

export function usePlayer() {
  const r = useContext(PlayerContext);
  if (!r) throw new Error('Missing PlayerContext');
  return r;
}
