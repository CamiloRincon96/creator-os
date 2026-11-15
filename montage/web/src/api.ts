import { personHeader } from './person';
import type { ProjectData, RepoEntry, ClaudeState, DeliveryInfo, Brand, Media, Note, Project, Summary, Version } from './types';

async function request<T>(method: string, route: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api${route}`, {
    method,
    headers: { ...personHeader(), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `HTTP ${r.status}`);
  return data as T;
}

export const api = {
  state: () => request<{ projects: Summary[]; claude: ClaudeState; brands: Brand[] }>('GET', '/state'),
  project: (id: string) => request<ProjectData>('GET', `/projects/${id}`),
  createProject: (data: Partial<Project> & { name: string }) => request<Project>('POST', '/projects', data),
  editProject: (id: string, changes: Partial<Project>) => request<Project>('PATCH', `/projects/${id}`, changes),
  addVersion: (id: string, data: { paths: string[]; note?: string }) => request<Version>('POST', `/projects/${id}/versions`, data),
  editVersion: (id: string, v: string, changes: { state?: string; note?: string }) =>
    request<Version>('PATCH', `/projects/${id}/versions/${v}`, changes),
  markFinal: (id: string, version: string | null) => request<Project>('POST', `/projects/${id}/final`, { version }),
  createNote: (id: string, data: Partial<Note>) => request<Note>('POST', `/projects/${id}/notes`, data),
  editNote: (id: string, n: number, changes: Partial<Note> & { message?: string }) =>
    request<Note>('PATCH', `/projects/${id}/notes/${n}`, changes),
  deleteNote: (id: string, n: number) => request<Note>('DELETE', `/projects/${id}/notes/${n}`),
  send: (id: string, message: string) =>
    request<{ sent: number[]; submission: string; listening: boolean }>('POST', `/projects/${id}/send`, { message }),
  media: (path: string) => request<Media>('GET', `/media?path=${encodeURIComponent(path)}&priority=1`),
  repo: (dir: string) => request<{ dir: string; entries: RepoEntry[] }>('GET', `/repo?dir=${encodeURIComponent(dir)}`),
  clearCache: () => request<{ deleted: number }>('POST', '/cache/clear'),
  deliveryInfo: (id: string) => request<DeliveryInfo>('GET', `/projects/${id}/delivery`),
  deliver: (id: string, data: { variants: string[]; folder: string; overwrite?: boolean }) =>
    request<{ job: string; files: string[]; destination: string }>('POST', `/projects/${id}/deliver`, data),
  reveal: (path: string) => request<{ ok: boolean }>('POST', '/reveal', { path }),
  rasters: (id: string, keys: string[]) => request<{ existing: string[] }>('GET', `/projects/${id}/rasters?keys=${keys.join(',')}`),
  uploadRasters: (id: string, rasters: { key: string; png: string }[]) => request<{ saved: number }>('POST', `/projects/${id}/rasters`, { rasters }),
  export: (id: string, note: string) => request<{ job: string; duration: number }>('POST', `/projects/${id}/export`, { note }),
  context: (id: string) => request<{ text: string; template: string; rules: string[] }>('GET', `/projects/${id}/context`),
  saveContext: (id: string, text: string) => request<{ ok: boolean }>('PUT', `/projects/${id}/context`, { text }),
  stopClaude: () => request<{ stopped: number }>('POST', '/claude/stop', {}),
  shutdown: () => request<{ ok: boolean }>('POST', '/shutdown', {}),
  document: <T,>(id: string, kind: 'image' | 'timeline') => request<T | null>('GET', `/projects/${id}/document/${kind}`),
  saveDocument: <T,>(id: string, kind: 'image' | 'timeline', doc: T, force = false) =>
    request<T & { rev: number }>('PUT', `/projects/${id}/document/${kind}${force ? '?force=1' : ''}`, doc),
};

/** Uploads a file to the project media (logos, photos, music). Returns the path relative to the repo. */
export async function uploadMedia(project: string, file: File | Blob, name: string): Promise<string> {
  const r = await fetch(`/api/projects/${project}/media?name=${encodeURIComponent(name)}`, { method: 'POST', headers: personHeader(), body: file });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d.path as string;
}

/** Error with the list of files that already exist (409 response from /deliver). */
export async function deliverWithConflicts(id: string, data: { variants: string[]; folder: string; overwrite?: boolean }) {
  const r = await fetch(`/api/projects/${id}/deliver`, { method: 'POST', headers: { ...personHeader(), 'content-type': 'application/json' }, body: JSON.stringify(data) });
  const d = await r.json().catch(() => ({}));
  if (r.status === 409) return { conflict: (d.existing as string[]) || [] };
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return { job: d.job as string, files: d.files as string[], destination: d.destination as string };
}

/** Uploads a raw file; returns the temporary path that /versions accepts. */
export function upload(file: File, onProgress?: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/uploads?name=${encodeURIComponent(file.name)}`);
    for (const [k, v] of Object.entries(personHeader())) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        if (xhr.status >= 400) reject(new Error(d.error || `HTTP ${xhr.status}`));
        else resolve(d.path);
      } catch (e) {
        reject(e);
      }
    };
    xhr.onerror = () => reject(new Error('The file could not be uploaded'));
    xhr.send(file);
  });
}

export const fileUrl = (project: string, path: string) => `/files/projects/${project}/${path.split('/').map(encodeURIComponent).join('/')}`;
export const repoUrl = (path: string) => `/files/repo/${path.split('/').map(encodeURIComponent).join('/')}`;
