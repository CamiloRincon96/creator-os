export type NoteState = 'draft' | 'sent' | 'in_progress' | 'question' | 'resolved' | 'approved' | 'reopened';
export type NoteType = 'add' | 'remove' | 'change' | 'fix' | 'idea';
export type ProjectType = 'video' | 'image' | 'carousel';
// 'creator' stays for older data; today each person on the team signs with their name.
export type Author = 'claude' | 'creator' | 'person';

export interface Meta {
  type: 'video' | 'image' | 'audio';
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  frames?: number;
  codec?: string;
  hasAudio?: boolean;
  size?: number;
}

export interface VersionFile {
  /** Its files were deleted when the version was archived. */
  archived?: boolean;
  name: string;
  path: string;
  type: Meta['type'];
  meta: Meta;
  source?: string;
}

export interface Marker {
  t: number;
  text: string;
}

export interface Version {
  id: string;
  files: VersionFile[];
  author: Author;
  name?: string;
  created: string;
  note: string;
  origin: string;
  resolves: number[];
  markers: Marker[];
  state: 'review' | 'discarded' | 'final';
  /** Date its files were deleted when the piece was finished (archive); notes and history stay. */
  archived?: string;
  /** The /creator-reel stage it closes (the review report says it). */
  stage?: number;
  /** The independent reviewer's score (1 to 10 per axis) and the person's stars (1 to 5). */
  rating?: {
    reviewer?: { axes: { axis: string; score: number }[]; average: number | null; minimum: number | null; verdict: string; skipped?: string[] };
    person?: { stars: number; name?: string; date: string };
  };
}

export interface Format {
  width: number;
  height: number;
  fps?: number | null;
}

export interface Project {
  id: string;
  name: string;
  brand: string;
  type: ProjectType;
  format: Format | null;
  origin: string;
  delivery: { folder: string };
  final: string | null;
  versions: Version[];
  created: string;
  updated: string;
}

interface Stroke {
  color: string;
  thickness?: number;
}
export type Shape =
  | (Stroke & { type: 'rect' | 'ellipse'; x: number; y: number; w: number; h: number })
  | (Stroke & { type: 'arrow'; x1: number; y1: number; x2: number; y2: number })
  | (Stroke & { type: 'stroke'; points: number[] })
  | (Stroke & { type: 'text'; x: number; y: number; text: string; size?: number })
  | (Stroke & { type: 'pin'; x: number; y: number });

export interface ThreadMessage {
  author: Author;
  name?: string;
  text: string;
  date: string;
  version?: string;
}

export interface Note {
  n: number;
  version: string | null;
  page: number | null;
  frame: number | null;
  frameEnd: number | null;
  fps: number | null;
  t: number | null;
  tEnd: number | null;
  shapes: Shape[];
  text: string;
  type: NoteType;
  state: NoteState;
  thread: ThreadMessage[];
  capture: { png: string; jpg: string; zone: string | null; at: number } | null;
  captureError?: string;
  created: string;
  createdBy?: string;
  updated: string;
  sentAt?: string;
  resolvedIn?: string;
}

export interface Activity {
  date: string;
  author: Author;
  name?: string;
  type: string;
  text: string;
  version?: string;
}

export interface StripInfo {
  interval: number;
  count: number;
  columns: number;
  rows: number;
  width: number;
  height: number;
}

export interface Media {
  key: string;
  meta: Meta;
  urls: { preview: string | null; audio: string | null; strip: string | null; peaks: string | null; poster: string | null };
  strip: StripInfo | null;
  preparing: boolean;
  stage: string | null;
  progress: number | null;
  error: string | null;
}

export interface ProjectData {
  project: Project;
  notes: Note[];
  activity: Activity[];
  media: Record<string, Media>;
  context?: string;
}

export interface Summary {
  id: string;
  name: string;
  brand: string;
  type: ProjectType;
  format: Format | null;
  final: string | null;
  versions: number;
  last: { id: string; author: Author; name?: string; created: string; note: string; pages: number } | null;
  poster: string | null;
  posterKey: string | null;
  notes: Partial<Record<NoteState, number>>;
  updated: string;
}

export interface ClaudeState {
  listening: boolean;
  since: string | null;
  pending: number;
  lastDelivered: string | null;
}

export interface Brand {
  id: string;
  name: string;
}

export interface Job {
  id: string;
  type?: 'delivery' | 'export';
  project: string;
  version: string | null;
  progress: number;
  stage: string;
  done: boolean;
  error: string | null;
  files: string[];
}

export interface DeliveryInfo {
  final: string | null;
  folder: string;
  variants: { id: string; name: string; description: string }[];
  deliveries: { version: string; date: string; files: string[] }[];
}

export interface RepoEntry {
  name: string;
  path: string;
  type: 'folder' | 'video' | 'image' | 'audio' | 'other';
  size: number;
}
