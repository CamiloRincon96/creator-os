import { Archive, ArchiveRestore, Columns2, Plus, SplitSquareHorizontal, Star, X } from 'lucide-react';
import { useState } from 'react';
import { readableTime } from '../../../shared/time.js';
import { api, fileUrl } from '../api';
import { notify, setStore, useStore } from '../state';
import { authorName } from '../person';
import type { ProjectData, Version } from '../types';
import { cx, shortDate } from '../util';
import { NewVersion } from './Dialogs';
import { onScrollShadow } from './NotesPanel';

export function VersionsPanel({ data }: { data: ProjectData }) {
  const p = data.project;
  const selVersion = useStore((s) => s.selVersion);
  const compare = useStore((s) => s.compare);
  const [adding, setAdding] = useState(false);
  const versions = [...p.versions].reverse();

  const action = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      notify(ok, 'ok', undefined, 3000);
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  return (
    <aside className="panel versions-panel">
      <header className="panel-head">
        <h2>Versions</h2>
        <button className="ico" onClick={() => setAdding(true)} title="Add a version from a file" aria-label="New version">
          <Plus size={17} />
        </button>
      </header>
      <div className="panel-body" onScroll={onScrollShadow}>
        {versions.map((v) => (
          <VersionCard
            key={v.id}
            v={v}
            project={p.id}
            poster={data.media[v.files[0]?.path]?.urls?.poster || null}
            sel={v.id === selVersion}
            comparing={v.id === compare}
            onSelect={() => setStore({ selVersion: v.id, compare: compare === v.id ? null : compare })}
            onCompare={() => setStore({ compare: v.id === compare ? null : v.id })}
            onFinal={() => action(() => api.markFinal(p.id, p.final === v.id ? null : v.id), p.final === v.id ? 'The final version was removed' : `${v.id} is the FINAL version`)}
            onDiscard={() =>
              action(() => api.editVersion(p.id, v.id, { state: v.state === 'discarded' ? 'review' : 'discarded' }), v.state === 'discarded' ? `${v.id} restored` : `${v.id} discarded`)
            }
            canCompare={v.id !== selVersion}
          />
        ))}
        {!versions.length && <p className="empty">No versions yet. Add a render with the + button or ask Claude for one.</p>}
      </div>
      {adding && <NewVersion project={p.id} multiple={p.type === 'carousel'} onClose={() => setAdding(false)} />}
    </aside>
  );
}

function VersionCard(props: {
  v: Version;
  project: string;
  poster: string | null;
  sel: boolean;
  comparing: boolean;
  canCompare: boolean;
  onSelect: () => void;
  onCompare: () => void;
  onFinal: () => void;
  onDiscard: () => void;
}) {
  const { v, poster, sel, comparing } = props;
  const a = v.files[0];
  const meta = a?.meta;
  const detail = meta?.type === 'video' ? `${readableTime(meta.duration || 0, 1)} s` : v.files.length > 1 ? `${v.files.length} pages` : `${meta?.width}×${meta?.height}`;
  // The version that just arrived (from Claude or the team) comes in with an Ice sweep.
  const fresh = Date.now() - new Date(v.created).getTime() < 20_000;
  return (
    <div
      className={cx('version', sel && 'sel', comparing && 'comparing', fresh && 'fresh', v.state)}
      onClick={props.onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={sel}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), props.onSelect())}
    >
      <div className="version-poster">
        {poster ? <img src={poster} alt="" loading="lazy" /> : a?.type === 'image' && !a.archived ? <img src={fileUrl(props.project, a.path)} alt="" loading="lazy" /> : <span className="no-poster" />}
      </div>
      <div className="version-info">
        <div className="version-head">
          <b>{v.id}</b>
          {v.state === 'final' && (
            <span className="final-stamp">
              <Star size={9} fill="currentColor" /> FINAL
            </span>
          )}
          {comparing && <span className="compare-stamp">B</span>}
        </div>
        <p className="version-date">
          {shortDate(v.created)} · <span className={cx(v.author === 'claude' && 'by-claude')}>{authorName(v.author, v.name)}</span>
        </p>
        <p className="version-note">{v.note || <span className="dim">No description</span>}</p>
        <p className="version-detail">
          {detail}
          {v.resolves.length > 0 && ` · resolved ${v.resolves.map((n) => '#' + n).join(' ')}`}
          {v.state === 'discarded' && ' · discarded'}
        </p>
      </div>
      <div className="version-actions" onClick={(e) => e.stopPropagation()}>
        {props.canCompare && (
          <button className={cx('ico mini', comparing && 'active')} onClick={props.onCompare} title={comparing ? 'Stop comparing' : 'Compare with the version you are viewing'} aria-label={comparing ? 'Stop comparing' : `Compare with ${v.id}`}>
            {comparing ? <X size={14} /> : <SplitSquareHorizontal size={14} />}
          </button>
        )}
        <button
          className={cx('ico mini', v.state === 'final' && 'final')}
          onClick={props.onFinal}
          title={v.state === 'final' ? 'Remove as final' : 'Mark as FINAL: the one that gets delivered'}
          aria-label={v.state === 'final' ? `Remove ${v.id} as final` : `Mark ${v.id} as final`}
        >
          <Star size={14} fill={v.state === 'final' ? 'currentColor' : 'none'} />
        </button>
        {v.state !== 'final' && (
          <button className="ico mini" onClick={props.onDiscard} title={v.state === 'discarded' ? 'Restore' : 'Discard (stays in the history)'} aria-label={v.state === 'discarded' ? `Restore ${v.id}` : `Discard ${v.id}`}>
            {v.state === 'discarded' ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

export function CompareBar({ a, b }: { a: string; b: string }) {
  const mode = useStore((s) => s.compareMode);
  return (
    <div className="compare-bar">
      <span>
        Comparing <b>{a}</b> with <b>{b}</b> {mode === 'curtain' ? '· drag the line' : '· side by side'}
      </span>
      <div className="segmented">
        <button className={cx(mode === 'curtain' && 'active')} onClick={() => setStore({ compareMode: 'curtain' })}>
          <SplitSquareHorizontal size={13} /> Curtain
        </button>
        <button className={cx(mode === 'side' && 'active')} onClick={() => setStore({ compareMode: 'side' })}>
          <Columns2 size={13} /> Side by side
        </button>
      </div>
      <button className="ico small" title="Stop comparing" aria-label="Stop comparing" onClick={() => setStore({ compare: null })}>
        <X size={14} />
      </button>
    </div>
  );
}
