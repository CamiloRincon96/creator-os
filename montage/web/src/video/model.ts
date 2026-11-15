// Video editor timeline. Saved in projects/<id>/timeline.json and Claude can edit it too.
// Times in seconds (always on frame boundaries); positions in frame pixels.

import type { ImageLayer, TextLayer } from '../image/model';

export interface Track {
  id: string;
  type: 'video' | 'audio';
  name: string;
  muted?: boolean;
  hidden?: boolean;
  locked?: boolean;
}

export interface Transform {
  scale: number;
  x: number;
  y: number;
  rotation: number;
  fit: 'cover' | 'contain';
}

interface BaseClip {
  id: string;
  track: string;
  start: number;
  duration: number;
  fadeIn: number;
  fadeOut: number;
}

export interface VideoClip extends BaseClip {
  type: 'video';
  path: string;
  name: string;
  sourceIn: number;
  speed: number;
  volume: number;
  opacity: number;
  transform: Transform;
  /** Total duration of the media (so it is not trimmed beyond it). */
  length: number;
  hasAudio: boolean;
}

export interface AudioClip extends BaseClip {
  type: 'audio';
  path: string;
  name: string;
  sourceIn: number;
  speed: number;
  volume: number;
  length: number;
}

export interface LayerClip extends BaseClip {
  type: 'text' | 'image';
  opacity: number;
  layer: TextLayer | ImageLayer;
}

export type Clip = VideoClip | AudioClip | LayerClip;

export interface Timeline {
  rev?: number;
  format: { width: number; height: number; fps: number };
  background: string;
  tracks: Track[];
  clips: Clip[];
}

export const newClipId = () => 'c' + Math.random().toString(36).slice(2, 8);

export function emptyTimeline(width: number, height: number, fps: number): Timeline {
  return {
    format: { width, height, fps },
    background: '#000000',
    tracks: [
      { id: 'V3', type: 'video', name: 'Text' },
      { id: 'V2', type: 'video', name: 'V2' },
      { id: 'V1', type: 'video', name: 'V1' },
      { id: 'A1', type: 'audio', name: 'Voice' },
      { id: 'A2', type: 'audio', name: 'Music' },
    ],
    clips: [],
  };
}

export const baseTransform = (): Transform => ({ scale: 1, x: 0, y: 0, rotation: 0, fit: 'cover' });

/** Total duration: up to where the last clip ends. */
export function timelineDuration(tl: Timeline) {
  return tl.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
}

export const end = (c: Clip) => c.start + c.duration;
export const toFrame = (t: number, fps: number) => Math.round(t * fps) / fps;

export function hasMedia(c: Clip): c is VideoClip | AudioClip {
  return c.type === 'video' || c.type === 'audio';
}

/** Longest possible duration of a clip given what is left of the media. */
export function maxDuration(c: Clip) {
  if (!hasMedia(c)) return Infinity;
  return (c.length - c.sourceIn) / c.speed;
}

/** Splits a clip at t (timeline time). Returns the two pieces, or null if t does not fall inside. */
export function split(c: Clip, t: number, fps: number): [Clip, Clip] | null {
  t = toFrame(t, fps);
  if (t <= c.start + 0.5 / fps || t >= end(c) - 0.5 / fps) return null;
  const left = { ...c, duration: t - c.start, fadeOut: 0 } as Clip;
  const right = { ...c, id: newClipId(), start: t, duration: end(c) - t, fadeIn: 0 } as Clip;
  if (hasMedia(right)) (right as VideoClip | AudioClip).sourceIn = (c as VideoClip | AudioClip).sourceIn + (t - c.start) * (c as VideoClip | AudioClip).speed;
  return [left, right];
}

/** Ripple delete: the later clips on the same track move to the left. */
export function rippleDelete(tl: Timeline, ids: string[]): Timeline {
  const deleted = tl.clips.filter((c) => ids.includes(c.id));
  let clips = tl.clips.filter((c) => !ids.includes(c.id));
  for (const b of deleted.sort((x, y) => y.start - x.start)) {
    clips = clips.map((c) => (c.track === b.track && c.start >= end(b) - 1e-6 ? { ...c, start: c.start - b.duration } : c));
  }
  return { ...tl, clips };
}

/** Snap points: clip edges (except the clips being moved), the playhead and zero. */
export function snapPoints(tl: Timeline, exclude: string[], playhead: number) {
  const p = [0, playhead];
  for (const c of tl.clips) if (!exclude.includes(c.id)) p.push(c.start, end(c));
  return p;
}

export function snap(t: number, points: number[], tolerance: number) {
  let best = t;
  let dist = tolerance;
  for (const p of points) {
    const d = Math.abs(p - t);
    if (d < dist) {
      dist = d;
      best = p;
    }
  }
  return { t: best, snapped: best !== t };
}

/** 0–1 factor of the fades at t (timeline time). */
export function fade(c: Clip, t: number) {
  let f = 1;
  if (c.fadeIn > 0) f = Math.min(f, (t - c.start) / c.fadeIn);
  if (c.fadeOut > 0) f = Math.min(f, (end(c) - t) / c.fadeOut);
  return Math.max(0, Math.min(1, f));
}
