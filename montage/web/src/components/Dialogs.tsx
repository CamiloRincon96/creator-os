import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FORMATS } from '../../../shared/formats.js';
import { api } from '../api';
import { notify, dismissToast, setStore, useStore } from '../state';
import type { ProjectType } from '../types';
import { cx } from '../util';
import { pathsFromSelection, FilePicker, selectionType, type Selection } from './FilePicker';

export function Modal({ title, onClose, children, width = 560 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }} role="dialog" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="ico" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function NewProject({ onClose }: { onClose: () => void }) {
  const brands = useStore((s) => s.brands);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState(brands[0]?.id || 'example');
  const [type, setType] = useState<ProjectType | ''>('');
  const [format, setFormat] = useState('reel');
  const [sel, setSel] = useState<Selection>({ local: [], repo: [] });
  const [progress, setProgress] = useState('');
  const effectiveType: ProjectType = type || (sel.local.length + sel.repo.length ? selectionType(sel) : 'video');

  const create = async () => {
    if (!name.trim()) return notify('Give the project a name.', 'error');
    try {
      setProgress('Creating…');
      const f = FORMATS.find((x: { id: string }) => x.id === format);
      const p = await api.createProject({ name: name.trim(), brand, type: effectiveType, format: f ? { width: f.width, height: f.height } : null });
      if (sel.local.length || sel.repo.length) {
        const paths = await pathsFromSelection(sel, setProgress);
        setProgress('Creating version 1…');
        await api.addVersion(p.id, { paths, note: 'Initial version' });
      }
      onClose();
      location.hash = `#/p/${p.id}`;
    } catch (e) {
      setProgress('');
      notify((e as Error).message, 'error');
    }
  };

  return (
    <Modal title="New project" onClose={onClose} width={620}>
      <div className="form">
        <label>
          Name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Launch reel, Carousel 02…" onKeyDown={(e) => e.key === 'Enter' && create()} />
        </label>
        <div className="row">
          <label>
            Brand
            <select value={brand} onChange={(e) => setBrand(e.target.value)}>
              {brands.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select value={type} onChange={(e) => setType(e.target.value as ProjectType | '')}>
              <option value="">Automatic ({effectiveType})</option>
              <option value="video">Video</option>
              <option value="image">Image</option>
              <option value="carousel">Carousel</option>
            </select>
          </label>
          <label>
            Format
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {FORMATS.map((f: { id: string; name: string; width: number; height: number }) => (
                <option key={f.id} value={f.id}>
                  {f.name} · {f.width}×{f.height}
                </option>
              ))}
            </select>
          </label>
        </div>
        <FilePicker value={sel} onChange={setSel} />
        <p className="track">The files are saved as version 1. Versions are cloned without taking extra space.</p>
      </div>
      <footer>
        {progress && <span className="track">{progress}</span>}
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={!!progress} onClick={create}>
          Create project
        </button>
      </footer>
    </Modal>
  );
}

export function NewVersion({ project, multiple, onClose }: { project: string; multiple: boolean; onClose: () => void }) {
  const [sel, setSel] = useState<Selection>({ local: [], repo: [] });
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState('');
  const create = async () => {
    try {
      setProgress('Preparing…');
      const paths = await pathsFromSelection(sel, setProgress);
      setProgress('Creating version…');
      const v = await api.addVersion(project, { paths, note: note.trim() });
      setStore({ selVersion: v.id, compare: null });
      onClose();
    } catch (e) {
      setProgress('');
      notify((e as Error).message, 'error');
    }
  };
  return (
    <Modal title="New version" onClose={onClose} width={620}>
      <div className="form">
        <FilePicker value={sel} onChange={setSel} multiple={multiple} />
        <label>
          What changed? (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Adjusted the color of the ending…" />
        </label>
      </div>
      <footer>
        {progress && <span className="track">{progress}</span>}
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={!!progress || !(sel.local.length + sel.repo.length)} onClick={create}>
          Add version
        </button>
      </footer>
    </Modal>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((a) => (
        <div key={a.id} className={cx('toast', a.level)}>
          <span>{a.text}</span>
          {a.action && (
            <button
              onClick={() => {
                a.action!.fn();
                dismissToast(a.id);
              }}
            >
              {a.action.text}
            </button>
          )}
          <button className="close" onClick={() => dismissToast(a.id)} title="Close">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / pause'],
  ['J · K · L', 'Back · pause · forward (repeat to speed up)'],
  ['← →', 'Previous / next frame'],
  ['Shift + ← →', 'One second back / forward'],
  ['Home · End', 'Go to the start / the end'],
  ['I · O · X', 'Mark in · out · clear range'],
  ['C', 'New note on this frame'],
  ['V R E A P T N', 'Pointer · rectangle · circle · arrow · pencil · text · point'],
  ['Cmd + Z', 'Undo the last stroke'],
  ['[ · ]', 'Previous / next note'],
  ['G', 'Safe zones'],
  ['M', 'Mute'],
  ['Z · Shift + Z', 'Fit to window · 100 %'],
  ['Cmd + wheel', 'Zoom in the viewer or the timeline'],
  ['Cmd + Enter', 'Send to Claude'],
  ['Esc', 'Close / deselect'],
];

export function Help({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} width={520}>
      <dl className="shortcuts">
        {SHORTCUTS.map(([k, d]) => (
          <div key={k}>
            <dt>
              {k.split(' · ').map((x, i) => (
                <kbd key={i}>{x}</kbd>
              ))}
            </dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
