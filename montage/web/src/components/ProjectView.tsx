import { useEffect, useMemo } from 'react';
import { fileUrl } from '../api';
import { notify, setStore, getStore, useStore } from '../state';
import { PlayerContext, Player, usePlayer } from '../engine/player';
import { clock } from '../clock';
import { zonesFor } from '../../../shared/formats.js';
import type { Note, Version } from '../types';
import { cx, isTyping } from '../util';
import { openProject } from '../live';
import { ProjectHeader, type Mode } from './Header';
import { FullscreenButton, Tools, ZoneSelector, TOOL_KEYS, Transport, undoShape, setMarkIn, setMarkOut, nextZone } from './Controls';
import { Help } from './Dialogs';
import { ImageEditor } from '../image/ImageEditor';
import { VideoEditor } from '../video/VideoEditor';
import { ReviewTimeline } from './ReviewTimeline';
import { SidePanel, startNote } from './NotesPanel';
import { CompareBar, VersionsPanel } from './VersionsPanel';
import { Viewer } from './Viewer';
import { SocialView } from './SocialView';

export function ProjectView({ id, mode }: { id: string; mode: Mode }) {
  const player = useMemo(() => new Player(), []);
  const data = useStore((s) => s.data);
  const selVersion = useStore((s) => s.selVersion);
  const selPage = useStore((s) => s.selPage);
  const compare = useStore((s) => s.compare);
  const selNote = useStore((s) => s.selNote);
  const help = useStore((s) => s.help);

  useEffect(() => {
    clock.set(0);
    openProject(id).catch((e) => notify(`Could not open the project: ${e.message}`, 'error'));
    return () => player.pause();
  }, [id, player]);

  if (!data || data.project.id !== id) return <div className="loading">Opening project…</div>;

  const p = data.project;
  const version = p.versions.find((v) => v.id === selVersion) ?? p.versions.at(-1);
  const versionB = compare ? p.versions.find((v) => v.id === compare) ?? null : null;

  const archived = !!version?.archived;
  const first = version?.files[0];
  const isVideo = first?.type === 'video';
  const withTimeline = !!version && (isVideo || version.files.length > 1);

  return (
    <PlayerContext.Provider value={player}>
      <div className="project">
        <ProjectHeader project={p} notes={data.notes} mode={mode} withVersions={!!version} />
        {mode === 'edit' && version && !archived ? (
          p.type === 'video' ? (
            <VideoEditor project={p} version={version} />
          ) : (
            <ImageEditor project={p} version={version} page={selPage} />
          )
        ) : mode === 'social' && version && !archived ? (
          <SocialView data={data} version={version} />
        ) : (
          <div className={cx('project-body', !withTimeline && 'no-timeline')}>
            <VersionsPanel data={data} />
            {version && archived ? (
              <main className="panel viewer-panel empty-center">
                <p>Version {version.id} is archived.</p>
                <p className="dim">Its files were deleted to free up space when the piece was finished. The notes and the history are still here; the FINAL keeps its files.</p>
              </main>
            ) : version ? (
              <Center version={version} versionB={versionB?.archived ? null : versionB} selPage={selPage} selNote={selNote} />
            ) : (
              <main className="panel viewer-panel empty-center">
                <p>This project has no versions yet.</p>
                <p className="dim">
                  Add a render with the + button in Versions, or ask Claude to publish with <code>node montage/cli.mjs publish {p.id} &lt;file&gt;</code>.
                </p>
              </main>
            )}
            <SidePanel data={data} selVersion={version?.id ?? null} isVideo={isVideo} fps={first?.meta.fps || 30} onSelect={(n) => selectNote(n, player)} />
          </div>
        )}
      </div>
      {help && <Help onClose={() => setStore({ help: false })} />}
    </PlayerContext.Provider>
  );
}

function selectNote(n: Note, player: Player) {
  const s = getStore();
  setStore({ selNote: n.n, ...(s.draft && !s.draft.shapes.length && !s.draft.text ? { draft: null } : {}) });
  if (n.page !== null) setStore({ selPage: n.page });
  if (n.frame !== null) {
    player.pause();
    player.goToFrame(n.frame);
    if (n.frameEnd !== null) setStore({ markIn: n.frame, markOut: n.frameEnd });
  }
}

function Center({ version, versionB, selPage, selNote }: { version: Version; versionB: Version | null; selPage: number; selNote: number | null }) {
  const player = usePlayer();
  const data = useStore((s) => s.data)!;
  const p = data.project;
  const page = Math.min(selPage, version.files.length - 1);
  const file = version.files[page];
  const fileB = versionB ? versionB.files[Math.min(page, versionB.files.length - 1)] : null;
  const media = data.media[file.path];
  const isVideo = file.type === 'video';
  const fps = file.meta.fps || 30;
  const duration = file.meta.duration || 0;
  const note = selNote ? data.notes.find((n) => n.n === selNote) ?? null : null;
  const notesHere = data.notes.filter((n) => n.version === version.id && (p.type !== 'carousel' || n.page === page));
  const width = file.meta.width || 1080;
  const height = file.meta.height || 1920;

  return (
    <>
      <main className="panel viewer-panel">
        {versionB && <CompareBar a={version.id} b={versionB.id} />}
        <div className="viewer-area">
          <Viewer
            project={p.id}
            file={file}
            media={media}
            label={version.id}
            b={fileB ? { file: fileB, media: data.media[fileB.path], label: versionB!.id } : null}
            note={note && (note.page === null || note.page === page) ? note : null}
            noteFromOtherVersion={!!note && note.version !== version.id}
          />
          <Tools />
        </div>
        {isVideo ? <Transport fps={fps} duration={duration} width={width} height={height} /> : <ImageBar width={width} height={height} pages={version.files.length} page={page} />}
      </main>
      {isVideo ? (
        <section className="panel panel-timeline">
          <ReviewTimeline media={media} duration={duration} fps={fps} notes={notesHere} markers={version.markers} onSelectNote={(n) => selectNote(n, player)} />
        </section>
      ) : (
        version.files.length > 1 && (
          <section className="panel panel-timeline">
            <PageStrip project={p.id} version={version} page={page} />
          </section>
        )
      )}
      <Shortcuts isVideo={isVideo} width={width} height={height} notes={notesHere} />
    </>
  );
}

function ImageBar({ width, height, pages, page }: { width: number; height: number; pages: number; page: number }) {
  const zone = useStore((s) => s.zone);
  const zones = zonesFor(width, height) as { id: string; name: string }[];
  return (
    <div className="transport image">
      <span className="tc-total">
        {width} × {height} px{pages > 1 && ` · page ${page + 1} of ${pages}`}
      </span>
      <div className="transport-options">
        {zones.length > 0 && <ZoneSelector zones={zones} zone={zone} />}
        <FullscreenButton />
      </div>
    </div>
  );
}

function PageStrip({ project, version, page }: { project: string; version: Version; page: number }) {
  const data = useStore((s) => s.data)!;
  return (
    <div className="page-strip" role="tablist" aria-label="Carousel pages">
      {version.files.map((a, i) => {
        const notes = data.notes.filter((n) => n.version === version.id && n.page === i && !['approved'].includes(n.state)).length;
        return (
          <button key={a.path} role="tab" aria-selected={i === page} className={cx('page', i === page && 'sel')} onClick={() => setStore({ selPage: i, selNote: null })} title={a.name}>
            <img src={data.media[a.path]?.urls?.poster || fileUrl(project, a.path)} alt="" loading="lazy" />
            <span className="page-n">{i + 1}</span>
            {notes > 0 && <span className="page-notes">{notes}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Shortcuts({ isVideo, width, height, notes }: { isVideo: boolean; width: number; height: number; notes: Note[] }) {
  const player = usePlayer();
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const k = e.key;
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && k === 'Enter') {
        e.preventDefault();
        window.dispatchEvent(new Event('montage:send'));
        return;
      }
      if (cmd && k.toLowerCase() === 'z' && !e.shiftKey) {
        if (getStore().draft?.shapes.length) {
          e.preventDefault();
          undoShape();
        }
        return;
      }
      if (cmd || e.altKey) return;
      if (k === '?') return setStore({ help: true });
      if (k === 'Escape') {
        const s = getStore();
        if (s.draft && !s.draft.shapes.length && !s.draft.text) setStore({ draft: null });
        else if (s.compare) setStore({ compare: null });
        else setStore({ selNote: null });
        return;
      }
      if (k === 'c') {
        e.preventDefault();
        player.pause();
        return startNote();
      }
      if (k === 'g') return nextZone(width, height);
      if (k === 'm') return setStore({ muted: !getStore().muted });
      if (k === '[' || k === ']') {
        const timed = notes.filter((n) => n.frame !== null).sort((a, b) => a.frame! - b.frame!);
        if (!timed.length) return;
        const current = player.frame;
        const next = k === ']' ? timed.find((n) => n.frame! > current) ?? timed[0] : [...timed].reverse().find((n) => n.frame! < current) ?? timed.at(-1)!;
        setStore({ selNote: next.n });
        player.pause();
        player.goToFrame(next.frame!);
        return;
      }
      const tool = TOOL_KEYS[k.toLowerCase()];
      if (tool && !e.shiftKey) return setStore({ tool });
      if (!isVideo) return;
      switch (k) {
        case ' ':
          e.preventDefault();
          player.toggle();
          break;
        case 'k':
          player.pause();
          break;
        case 'l':
          player.forward();
          break;
        case 'j':
          player.backward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            player.pause();
            player.jump(-1);
          } else player.step(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            player.pause();
            player.jump(1);
          } else player.step(1);
          break;
        case 'Home':
          e.preventDefault();
          player.goToStart();
          break;
        case 'End':
          e.preventDefault();
          player.goToEnd();
          break;
        case 'i':
          setMarkIn(player.frame);
          break;
        case 'o':
          setMarkOut(player.frame);
          break;
        case 'x':
          setStore({ markIn: null, markOut: null });
          break;
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [player, isVideo, width, height, notes]);
  return null;
}
