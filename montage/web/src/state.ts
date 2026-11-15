import { create } from 'zustand';
import type { ProjectData, ClaudeState, Shape, Brand, Media, Summary, NoteType, Job } from './types';

export type Tool = 'pointer' | 'rect' | 'ellipse' | 'arrow' | 'stroke' | 'text' | 'pin';
export type Filter = 'pending' | 'resolved' | 'all';
export type SideTab = 'notes' | 'context' | 'activity';

export interface Draft {
  shapes: Shape[];
  text: string;
  type: NoteType;
  whole: boolean;
}

export interface Toast {
  id: number;
  text: string;
  level: 'info' | 'ok' | 'error' | 'claude';
  action?: { text: string; fn: () => void };
}

interface State {
  connected: boolean;
  /** The server said it shut down (Shut down button or `cli.mjs stop`). */
  shutDown: boolean;
  claude: ClaudeState;
  summaries: Summary[];
  brands: Brand[];
  data: ProjectData | null;

  selVersion: string | null;
  selPage: number;
  tool: Tool;
  color: string;
  draft: Draft | null;
  selNote: number | null;
  filter: Filter;
  tab: SideTab;
  zone: string | null;
  markIn: number | null;
  markOut: number | null;
  playing: boolean;
  speed: number;
  loop: boolean;
  muted: boolean;
  compare: string | null;
  compareMode: 'curtain' | 'side';
  curtain: number;
  help: boolean;
  toasts: Toast[];
  jobs: Record<string, Job>;
}

export const useStore = create<State>(() => ({
  connected: false,
  shutDown: false,
  claude: { listening: false, since: null, pending: 0, lastDelivered: null },
  summaries: [],
  brands: [],
  data: null,

  selVersion: null,
  selPage: 0,
  tool: 'rect',
  color: '#ff3b30',
  draft: null,
  selNote: null,
  filter: 'pending',
  tab: 'notes',
  zone: null,
  markIn: null,
  markOut: null,
  playing: false,
  speed: 1,
  loop: false,
  muted: false,
  compare: null,
  compareMode: 'curtain',
  curtain: 0.5,
  help: false,
  toasts: [],
  jobs: {},
}));

export const setStore = (partial: Partial<State>) => useStore.setState(partial);
export const getStore = () => useStore.getState();

let nextToast = 1;
export function notify(text: string, level: Toast['level'] = 'info', action?: Toast['action'], ms = 5000) {
  const id = nextToast++;
  useStore.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, level, action }] }));
  setTimeout(() => dismissToast(id), ms);
}
export const dismissToast = (id: number) => useStore.setState((s) => ({ toasts: s.toasts.filter((a) => a.id !== id) }));

/** Updates the state of a media file in the open project and in the summaries. */
export function updateMedia(media: Media) {
  useStore.setState((s) => {
    const changes: Partial<State> = {};
    if (s.data) {
      let touched = false;
      const all = { ...s.data.media };
      for (const [path, m] of Object.entries(all)) {
        if (m && m.key === media.key) {
          all[path] = media;
          touched = true;
        }
      }
      if (touched) changes.data = { ...s.data, media: all };
    }
    if (media.urls.poster && s.summaries.some((r) => r.posterKey === media.key)) {
      changes.summaries = s.summaries.map((r) => (r.posterKey === media.key ? { ...r, poster: media.urls.poster } : r));
    }
    return changes;
  });
}

export function newDraft(): Draft {
  return { shapes: [], text: '', type: 'change', whole: false };
}
