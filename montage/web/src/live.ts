// Live connection with the server: when Claude (or the disk) changes something, it arrives here.

import { api } from './api';
import { updateMedia, notify, setStore, getStore } from './state';
import { authorName } from './person';
import type { ProjectData, ClaudeState, Media, Summary, Job } from './types';

type Message =
  | { type: 'hello'; claude: ClaudeState }
  | { type: 'shutdown' }
  | { type: 'claude'; claude: ClaudeState }
  | { type: 'media'; media: Media }
  | { type: 'summary'; summary: Summary }
  | { type: 'project-deleted'; id: string }
  | { type: 'job'; job: Job }
  | { type: 'document'; id: string; document: 'timeline' | 'image'; doc: { rev?: number } }
  | ({ type: 'project'; id: string } & ProjectData);

let attempts = 0;

export function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => {
    attempts = 0;
    setStore({ connected: true, shutDown: false });
    refreshSummaries().catch(() => {});
    const d = getStore().data;
    if (d) reloadProject(d.project.id).catch(() => {});
  };
  ws.onclose = () => {
    setStore({ connected: false });
    setTimeout(connect, Math.min(5000, 400 * 2 ** attempts++));
  };
  ws.onmessage = (e) => handle(JSON.parse(e.data) as Message);
}

function handle(m: Message) {
  switch (m.type) {
    case 'shutdown':
      setStore({ shutDown: true });
      break;
    case 'hello':
    case 'claude':
      setStore({ claude: m.claude });
      break;
    case 'media':
      updateMedia(m.media);
      break;
    case 'summary': {
      const list = getStore().summaries.filter((r) => r.id !== m.summary.id);
      setStore({ summaries: [...list, m.summary].sort((a, b) => a.id.localeCompare(b.id)) });
      break;
    }
    case 'project-deleted':
      setStore({ summaries: getStore().summaries.filter((r) => r.id !== m.id) });
      break;
    case 'job':
      setStore({ jobs: { ...getStore().jobs, [m.job.id]: m.job } });
      break;
    case 'document':
      // The open editors listen to it (timeline.json / image.json changed on disk).
      window.dispatchEvent(new CustomEvent('montage:document', { detail: m }));
      break;
    case 'project':
      if (getStore().data?.project.id === m.id) applyData({ project: m.project, notes: m.notes, activity: m.activity, media: m.media, context: m.context });
      break;
  }
}

/** Applies new data to the open project and announces what Claude did. */
export function applyData(incoming: ProjectData) {
  const s = getStore();
  const old = s.data;
  if (!old || old.project.id !== incoming.project.id) {
    setStore({
      data: incoming,
      selVersion: incoming.project.versions.at(-1)?.id ?? null,
      selPage: 0,
      selNote: null,
      draft: null,
      markIn: null,
      markOut: null,
      compare: null,
    });
    return;
  }

  const previous = new Set(old.project.versions.map((v) => v.id));
  const added = incoming.project.versions.filter((v) => !previous.has(v.id));
  for (const v of added) {
    notify(`${authorName(v.author, v.name)} published ${v.id}${v.note ? ` · ${v.note}` : ''}`, v.author === 'claude' ? 'claude' : 'ok', {
      text: 'View',
      fn: () => setStore({ selVersion: v.id, compare: null }),
    }, 9000);
  }
  let selVersion = s.selVersion;
  const lastPrevious = old.project.versions.at(-1)?.id ?? null;
  if (added.length && (selVersion === lastPrevious || !selVersion)) selVersion = added.at(-1)!.id;

  const answered: number[] = [];
  let lastText = '';
  for (const nt of incoming.notes) {
    const before = old.notes.find((x) => x.n === nt.n);
    if (!before) continue;
    const messages = nt.thread.slice(before.thread.length).filter((m) => m.author === 'claude');
    if (messages.length) {
      answered.push(nt.n);
      lastText = messages.at(-1)!.text;
    }
  }
  if (answered.length === 1) {
    notify(`Claude on #${answered[0]}: ${lastText}`, 'claude', { text: 'View note', fn: () => setStore({ selNote: answered[0] }) }, 8000);
  } else if (answered.length > 1) {
    notify(`Claude replied on ${answered.map((n) => '#' + n).join(', ')}`, 'claude', undefined, 8000);
  }

  setStore({ data: incoming, selVersion });
}

export async function openProject(id: string) {
  if (getStore().data?.project.id !== id) setStore({ data: null });
  applyData(await api.project(id));
}

export async function reloadProject(id: string) {
  applyData(await api.project(id));
}

export async function refreshSummaries() {
  const e = await api.state();
  setStore({ summaries: e.projects, claude: e.claude, brands: e.brands });
}
