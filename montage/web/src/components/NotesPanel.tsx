import { Check, CheckCheck, CircleHelp, MessageSquarePlus, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { timecode } from '../../../shared/time.js';
import { api, fileUrl } from '../api';
import { notify, setStore, getStore, newDraft, useStore, type Filter, type SideTab } from '../state';
import { usePlayer } from '../engine/player';
import { initials, authorName } from '../person';
import { clock } from '../clock';
import type { ProjectData, NoteState, Note, Project } from '../types';
import { STATES, TYPES, cx, ago } from '../util';
import { ClaudeAvatar } from './Claude';
import { ContextTab } from './Context';

const ORDER: Record<NoteState, number> = { question: 0, reopened: 1, draft: 2, sent: 3, in_progress: 4, resolved: 5, approved: 6 };
const FILTERS: Record<Filter, NoteState[]> = {
  pending: ['question', 'reopened', 'draft', 'sent', 'in_progress'],
  resolved: ['resolved'],
  all: ['question', 'reopened', 'draft', 'sent', 'in_progress', 'resolved', 'approved'],
};

interface Props {
  data: ProjectData;
  selVersion: string | null;
  isVideo: boolean;
  fps: number;
  onSelect: (n: Note) => void;
}

/** Right panel: review notes, project context and activity. */
export function SidePanel({ data, selVersion, isVideo, fps, onSelect }: Props) {
  const tab = useStore((s) => s.tab);
  const open = data.notes.filter((n) => FILTERS.pending.includes(n.state)).length;
  const tabs: [SideTab, string, number | null][] = [
    ['notes', 'Notes', open],
    ['context', 'Context', null],
    ['activity', 'Activity', null],
  ];
  return (
    <aside className="panel notes-panel">
      <div className="panel-tabs" role="tablist" aria-label="Side panel">
        {tabs.map(([id, text, count]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={cx(tab === id && 'active')} onClick={() => setStore({ tab: id })}>
            {text}
            {!!count && <span className="count">{count}</span>}
          </button>
        ))}
      </div>
      {tab === 'notes' && <Notes project={data.project} notes={data.notes} selVersion={selVersion} isVideo={isVideo} fps={fps} onSelect={onSelect} />}
      {tab === 'context' && (
        <div className="panel-body">
          <ContextTab project={data.project} />
        </div>
      )}
      {tab === 'activity' && <ActivityList data={data} />}
    </aside>
  );
}

function Notes({ project, notes, selVersion, isVideo, fps, onSelect }: { project: Project; notes: Note[]; selVersion: string | null; isVideo: boolean; fps: number; onSelect: (n: Note) => void }) {
  const filter = useStore((s) => s.filter);
  const draft = useStore((s) => s.draft);
  const selNote = useStore((s) => s.selNote);
  const list = notes
    .filter((n) => FILTERS[filter].includes(n.state))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || (a.t ?? -1) - (b.t ?? -1) || a.n - b.n);
  const count = (f: Filter) => notes.filter((n) => FILTERS[f].includes(n.state)).length;

  return (
    <>
      <div className="note-filters">
        {(['pending', 'resolved', 'all'] as Filter[]).map((f) => (
          <button key={f} className={cx('chip', filter === f && 'active')} onClick={() => setStore({ filter: f })} aria-pressed={filter === f}>
            {f === 'pending' ? 'Open' : f === 'resolved' ? 'To verify' : 'All'}
            <span className="count">{count(f)}</span>
          </button>
        ))}
      </div>
      <div className="panel-body" onScroll={onScrollShadow}>
        {draft ? (
          <Composer project={project} selVersion={selVersion} isVideo={isVideo} fps={fps} />
        ) : (
          <button className="new-note" onClick={() => startNote()}>
            <MessageSquarePlus size={16} />
            <span>
              New note
              <small>or draw right on the frame</small>
            </span>
            <kbd>C</kbd>
          </button>
        )}
        {list.length === 0 && !draft && (
          <p className="empty">
            {filter === 'resolved'
              ? 'Nothing to verify. When Claude resolves something, it shows up here.'
              : filter === 'all'
                ? 'No notes in this project yet.'
                : 'No open notes. Pause at the exact moment, draw and write.'}
          </p>
        )}
        {list.map((n) => (
          <NoteCard key={n.n} project={project} note={n} sel={selNote === n.n} selVersion={selVersion} fps={fps} onSelect={onSelect} />
        ))}
      </div>
    </>
  );
}

/** The list fades at the top only when there is content hidden under the filters. */
export const onScrollShadow = (e: React.UIEvent<HTMLElement>) => e.currentTarget.classList.toggle('scrolled', e.currentTarget.scrollTop > 2);

export function startNote() {
  if (!getStore().draft) setStore({ draft: newDraft(), selNote: null, tab: 'notes' });
  else setStore({ tab: 'notes' });
  setTimeout(() => document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus(), 30);
}

function Composer({ project, selVersion, isVideo, fps }: { project: Project; selVersion: string | null; isVideo: boolean; fps: number }) {
  const player = usePlayer();
  const draft = useStore((s) => s.draft)!;
  const markIn = useStore((s) => s.markIn);
  const markOut = useStore((s) => s.markOut);
  const selPage = useStore((s) => s.selPage);
  const [saving, setSaving] = useState(false);
  const when = useRef<HTMLSpanElement>(null);
  const hasRange = isVideo && markIn !== null && markOut !== null && markOut > markIn;

  useEffect(() => {
    if (!isVideo || hasRange || draft.whole) return;
    return clock.subscribe((t) => {
      if (when.current) when.current.textContent = timecode(t, fps);
    });
  }, [isVideo, hasRange, draft.whole, fps]);

  const change = (c: Partial<typeof draft>) => setStore({ draft: { ...draft, ...c } });

  const save = async () => {
    if (!draft.text.trim() && !draft.shapes.length) {
      notify('Write something or draw on the frame.', 'error');
      return;
    }
    setSaving(true);
    try {
      const data: Partial<Note> = {
        version: selVersion,
        text: draft.text.trim(),
        type: draft.type,
        shapes: draft.shapes,
        page: project.type === 'carousel' ? selPage : null,
      };
      if (isVideo && !draft.whole) {
        data.frame = hasRange ? markIn! : player.frame;
        if (hasRange) data.frameEnd = markOut!;
      }
      const note = await api.createNote(project.id, data);
      setStore({ draft: null, markIn: null, markOut: null, filter: 'pending' });
      notify(`Note #${note.n} saved. It goes out with Send to Claude.`, 'ok', undefined, 3500);
    } catch (e) {
      notify(`The note was not saved: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="composer">
      <div className="composer-head">
        <strong>New note</strong>
        <span className="when">
          {!isVideo ? (project.type === 'carousel' ? `page ${selPage + 1}` : 'image') : draft.whole ? 'whole piece' : hasRange ? `${timecode(markIn! / fps, fps)} → ${timecode(markOut! / fps, fps)}` : <span ref={when} />}
          {selVersion && ` · ${selVersion}`}
        </span>
        <button className="ico small" title="Discard (Esc)" aria-label="Discard note" onClick={() => setStore({ draft: null })}>
          <X size={14} />
        </button>
      </div>
      <div className="types" role="radiogroup" aria-label="Note type">
        {TYPES.map((t) => (
          <button key={t.id} role="radio" aria-checked={draft.type === t.id} className={cx('chip', draft.type === t.id && 'active')} onClick={() => change({ type: t.id })}>
            {t.text}
          </button>
        ))}
      </div>
      <textarea
        autoFocus
        rows={3}
        placeholder="What change do you want here? Enter saves, Shift+Enter adds a line."
        value={draft.text}
        onChange={(e) => change({ text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.metaKey) {
            e.preventDefault();
            save();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
      />
      <div className="composer-foot">
        {isVideo && (
          <label className="checkbox">
            <input type="checkbox" checked={draft.whole} onChange={(e) => change({ whole: e.target.checked })} /> Whole piece
          </label>
        )}
        <span className="track">
          {draft.shapes.length ? `${draft.shapes.length} stroke${draft.shapes.length === 1 ? '' : 's'}` : 'Draw on the frame to point things out'}
          {isVideo && !draft.whole && !hasRange && ' · I/O for a range'}
        </span>
        <button className="btn primary" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </div>
  );
}

function Signature({ author, name }: { author: string; name?: string }) {
  if (author === 'claude') return <ClaudeAvatar size={20} />;
  return (
    <span className="avatar-mini" aria-hidden>
      {initials(authorName(author, name))}
    </span>
  );
}

function NoteCard({ project, note, sel, selVersion, fps, onSelect }: { project: Project; note: Note; sel: boolean; selVersion: string | null; fps: number; onSelect: (n: Note) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [reply, setReply] = useState('');
  const [mode, setMode] = useState<'none' | 'comment' | 'reopen' | 'edit'>('none');
  const [text, setText] = useState(note.text);
  const e = STATES[note.state];
  const authorship = note.createdBy || note.thread.find((m) => m.author !== 'claude')?.name;

  useEffect(() => {
    if (sel) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [sel]);

  const action = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) notify(ok, 'ok', undefined, 3000);
      setReply('');
      setMode('none');
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  };

  const replyAndSend = () =>
    action(async () => {
      await api.editNote(project.id, note.n, { message: reply });
      const r = await api.send(project.id, '');
      if (!r.listening) notify('Reply sent. Claude is not listening: in Claude Code type /creator-notes.', 'info', undefined, 7000);
    }, 'Reply sent to Claude');

  return (
    <article ref={ref} className={cx('note', e.className, sel && 'sel')} onClick={() => onSelect(note)} aria-current={sel || undefined}>
      <header className="note-head">
        <span className="note-n">#{note.n}</span>
        <div className="note-title">
          <strong>{TYPES.find((t) => t.id === note.type)?.text}</strong>
          <span className="note-meta">
            {note.t !== null && note.fps ? (
              <span className="note-tc">
                {timecode(note.t, fps || note.fps)}
                {note.tEnd !== null && ` → ${timecode(note.tEnd, fps || note.fps)}`}
              </span>
            ) : note.page !== null ? (
              <span className="note-tc">p. {note.page + 1}</span>
            ) : (
              <span>Whole piece</span>
            )}
            {note.version && note.version !== selVersion && <span className="note-version">{note.version}</span>}
            {authorship && <span>{authorship}</span>}
          </span>
        </div>
        <span className={cx('state', e.className)}>{note.state === 'resolved' && note.resolvedIn ? `To verify in ${note.resolvedIn}` : e.text}</span>
      </header>
      {(mode === 'edit' || note.text || note.capture) && (
        <div className="note-body">
          {mode === 'edit' ? (
            <textarea
              className="edit-text"
              autoFocus
              value={text}
              onClick={(ev) => ev.stopPropagation()}
              onChange={(ev) => setText(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' && !ev.shiftKey) {
                  ev.preventDefault();
                  action(() => api.editNote(project.id, note.n, { text }));
                }
                if (ev.key === 'Escape') setMode('none');
              }}
            />
          ) : (
            <p className="note-text">{note.text}</p>
          )}
          {note.capture && (
            <a
              className="note-capture"
              href={fileUrl(project.id, note.capture.png) + `?v=${note.capture.at}`}
              target="_blank"
              rel="noreferrer"
              onClick={(ev) => ev.stopPropagation()}
              title="Open the full capture"
            >
              <img src={fileUrl(project.id, note.capture.jpg) + `?v=${note.capture.at}`} alt={`Capture of note ${note.n}`} loading="lazy" />
            </a>
          )}
        </div>
      )}
      {note.thread.length > 0 && (
        <ul className="thread">
          {note.thread.map((m, i) => (
            <li key={i} className={m.author === 'claude' ? 'claude' : 'person'}>
              <Signature author={m.author} name={m.name} />
              <div>
                <span className="author">
                  <b>{authorName(m.author, m.name)}</b> {ago(m.date)}
                  {m.version && ` · ${m.version}`}
                </span>
                <p>{m.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {note.state === 'resolved' && note.resolvedIn && (
        <p className="note-applied">
          <CheckCheck size={14} /> Applied in {note.resolvedIn}: check it, then approve or reopen
        </p>
      )}
      {note.state === 'approved' && (
        <p className="note-applied ok">
          <Check size={14} /> Approved{note.resolvedIn ? ` in ${note.resolvedIn}` : ''}
        </p>
      )}
      {note.state === 'question' && (
        <p className="note-applied question">
          <CircleHelp size={14} /> Claude needs your answer to continue
        </p>
      )}

      <div className="note-actions" onClick={(ev) => ev.stopPropagation()}>
        {(note.state === 'draft' || note.state === 'reopened') && (
          <>
            <span className="track">Goes out with the next send</span>
            {note.state === 'draft' && (
              <>
                <button className="btn small" onClick={() => (setText(note.text), setMode('edit'))}>
                  Edit
                </button>
                <button className="ico small" title="Delete note" aria-label={`Delete note ${note.n}`} onClick={() => action(() => api.deleteNote(project.id, note.n), `Note #${note.n} deleted`)}>
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </>
        )}
        {note.state === 'resolved' && mode !== 'reopen' && (
          <>
            <button className="btn small ok" onClick={() => action(() => api.editNote(project.id, note.n, { state: 'approved' }), `Note #${note.n} approved`)}>
              <Check size={14} /> Approve
            </button>
            <button className="btn small" onClick={() => setMode('reopen')}>
              <RotateCcw size={14} /> Reopen
            </button>
          </>
        )}
        {note.state === 'approved' && mode !== 'reopen' && (
          <button className="btn small" onClick={() => setMode('reopen')}>
            <RotateCcw size={14} /> Reopen
          </button>
        )}
        {(note.state === 'sent' || note.state === 'in_progress') && mode !== 'comment' && (
          <button className="btn small" onClick={() => setMode('comment')}>
            Add comment
          </button>
        )}
      </div>

      {(note.state === 'question' || mode === 'reopen' || mode === 'comment') && (
        <div className="reply" onClick={(ev) => ev.stopPropagation()}>
          <textarea
            rows={2}
            autoFocus={mode !== 'none'}
            placeholder={note.state === 'question' ? 'Reply to Claude…' : mode === 'reopen' ? 'What is missing or what did not come out right?' : 'Additional comment…'}
            value={reply}
            onChange={(ev) => setReply(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Escape') setMode('none');
            }}
          />
          <div className="row-right">
            {mode !== 'none' && (
              <button className="btn small" onClick={() => setMode('none')}>
                Cancel
              </button>
            )}
            {note.state === 'question' ? (
              <button className="btn small primary" disabled={!reply.trim()} onClick={replyAndSend}>
                <Send size={13} /> Reply and send
              </button>
            ) : (
              <button
                className="btn small primary"
                disabled={!reply.trim()}
                onClick={() => action(() => api.editNote(project.id, note.n, { message: reply }), mode === 'reopen' ? `Note #${note.n} reopened: it goes out with the next send` : 'Comment added')}
              >
                {mode === 'reopen' ? 'Reopen' : 'Comment'}
              </button>
            )}
          </div>
        </div>
      )}
      {note.captureError && <p className="error-small">Capture: {note.captureError}</p>}
    </article>
  );
}

function ActivityList({ data }: { data: ProjectData }) {
  const items = [...data.activity].reverse().slice(0, 60);
  return (
    <div className="panel-body">
      {!items.length && <p className="empty">This is where what Claude and the team do shows up: versions, sends, replies and deliveries.</p>}
      <ul className="activity">
        {items.map((a, i) => (
          <li key={i} className={a.author === 'claude' ? 'claude' : 'person'}>
            <Signature author={a.author} name={a.name} />
            <div>
              <p>{a.text}</p>
              <span className="dim small">
                {authorName(a.author, a.name)} · {ago(a.date)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
