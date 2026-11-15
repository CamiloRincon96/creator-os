import { Power, UserRound } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { api } from '../api';
import { notify, setStore, useStore } from '../state';
import { setPerson, initials, authorName, usePerson } from '../person';
import { useClickOutside } from '../util';

/** First time on this computer: the name signs notes, versions and replies. */
export function AskName() {
  const data = useStore((s) => s.data);
  const [name, setName] = useState('');
  const known = [
    ...new Set(
      (data?.activity ?? [])
        .filter((a) => a.author !== 'claude')
        .map((a) => authorName(a.author, a.name))
        .filter((n) => n !== 'Team'),
    ),
  ].slice(0, 4);
  const enter = (n = name) => n.trim() && setPerson(n);
  return (
    <div className="session-screen">
      <form
        className="session-card"
        onSubmit={(e) => {
          e.preventDefault();
          enter();
        }}
      >
        <img className="session-logo" src="/brand/montage-logo.svg" alt="Montage" />
        <h1>Who is reviewing?</h1>
        <p>Your name signs your notes, versions and replies, so the team and Claude know who asked for what. It is saved on this computer.</p>
        <input autoFocus value={name} maxLength={40} placeholder="Your name" aria-label="Your name" onChange={(e) => setName(e.target.value)} />
        {known.length > 0 && (
          <div className="session-known">
            {known.map((n) => (
              <button key={n} type="button" className="chip" onClick={() => enter(n)}>
                {n}
              </button>
            ))}
          </div>
        )}
        <button className="btn primary large" disabled={!name.trim()}>
          Enter Montage
        </button>
      </form>
    </div>
  );
}

/** Avatar of whoever is using Montage, with the option to change the name. */
export function PersonMenu() {
  const person = usePerson();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(person);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);
  return (
    <div className="popover-wrap" ref={ref}>
      <button className="avatar-person" title={`Reviewing as ${person}`} aria-label={`Reviewing as ${person}. Change name`} onClick={() => (setName(person), setOpen(!open))}>
        {initials(person)}
      </button>
      {open && (
        <form
          className="popover person-popover"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setPerson(name);
            setOpen(false);
            notify(`You now sign as ${name.trim()}`, 'ok', undefined, 2500);
          }}
        >
          <p className="popover-title">
            <UserRound size={15} /> Reviewing as {person}
          </p>
          <label className="field">
            Name
            <input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </label>
          <p className="track">Notes you already wrote keep the name they were signed with.</p>
          <div className="row-right">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" disabled={!name.trim() || name.trim() === person}>
              Save
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Shuts down the server on this computer; Claude stops listening. */
export function ShutdownButton() {
  const [open, setOpen] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);
  const shutdown = async () => {
    setShuttingDown(true);
    try {
      await api.shutdown();
      setStore({ shutDown: true });
    } catch (e) {
      setShuttingDown(false);
      notify(`Could not shut down: ${(e as Error).message}`, 'error');
    }
  };
  return (
    <div className="popover-wrap" ref={ref}>
      <button className="ico" title="Shut down Montage" aria-label="Shut down Montage" onClick={() => setOpen(!open)}>
        <Power size={17} />
      </button>
      {open && (
        <div className="popover shutdown-popover" role="dialog" aria-label="Shut down Montage">
          <p className="popover-title">
            <Power size={15} /> Shut down Montage?
          </p>
          <p>The server on this computer closes and Claude stops listening. Notes and versions already saved stay intact.</p>
          <p className="track">To come back: open the Montage app or type /creator-montage in Claude Code.</p>
          <div className="row-right">
            <button className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn danger" disabled={shuttingDown} onClick={shutdown}>
              <Power size={14} /> {shuttingDown ? 'Shutting down…' : 'Shut down'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ShutDownScreen() {
  return (
    <div className="session-screen shut-down" role="status">
      <div className="session-card">
        <img className="session-symbol" src="/brand/montage-symbol.svg" alt="" />
        <h1>Montage is shut down</h1>
        <p>The server closed and Claude stopped listening. Your projects, notes and versions stay saved.</p>
        <p className="track">To come back: open the Montage app or type /creator-montage in Claude Code. This window reconnects on its own if Montage opens again.</p>
        <button className="btn large" onClick={() => window.close()}>
          Close window
        </button>
      </div>
    </div>
  );
}
