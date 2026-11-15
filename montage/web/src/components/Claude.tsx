import { Asterisk, Copy, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { notify, useStore } from '../state';
import type { Note } from '../types';
import { TO_SEND, cx, useClickOutside } from '../util';

/** Claude's avatar: terracotta is reserved for it. */
export function ClaudeAvatar({ size = 20 }: { size?: number }) {
  return (
    <span className="avatar-claude" style={{ width: size, height: size }} aria-hidden>
      <Asterisk size={Math.round(size * 0.7)} strokeWidth={2.6} />
    </span>
  );
}

function Command({ text }: { text: string }) {
  return (
    <button
      className="command"
      title="Copy"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(text).then(
          () => notify(`Copied ${text}: paste it in Claude Code`, 'ok', undefined, 2500),
          () => {},
        );
      }}
    >
      {text} <Copy size={11} />
    </button>
  );
}

/** Listening / working / away, with what to type in Claude Code and the button to make it stop listening. */
export function ClaudePresence() {
  const claude = useStore((s) => s.claude);
  const connected = useStore((s) => s.connected);
  const summaries = useStore((s) => s.summaries);
  const data = useStore((s) => s.data);
  const [open, setOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);
  const inProgress =
    (data?.notes.some((n) => n.state === 'in_progress') ?? false) || summaries.some((r) => (r.notes.in_progress || 0) > 0);
  // Right after receiving a submission, Claude takes a few seconds to mark the notes "in progress".
  const recent = claude.lastDelivered && Date.now() - new Date(claude.lastDelivered).getTime() < 3 * 60_000;

  let state: 'no-server' | 'listening' | 'working' | 'away' = 'away';
  if (!connected) state = 'no-server';
  else if (inProgress || (recent && !claude.listening)) state = 'working';
  else if (claude.listening) state = 'listening';

  const text = {
    'no-server': 'Offline',
    listening: 'Claude listening',
    working: 'Claude working',
    away: 'Claude not listening',
  }[state];

  const stop = async () => {
    setStopping(true);
    try {
      await api.stopClaude();
      notify('Claude stopped listening. To resume, type /creator-montage in Claude Code.', 'info', undefined, 6000);
      setOpen(false);
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="popover-wrap" ref={ref}>
      <button className={cx('presence', state)} onClick={() => setOpen(!open)} aria-expanded={open} title="How does Claude work with Montage?">
        <span className="dot" />
        {text}
      </button>
      {open && (
        <div className="popover presence-popover">
          {state === 'listening' && (
            <>
              <p className="popover-title">Claude is listening</p>
              <p>When you press Send to Claude, it starts working on its own in the Claude Code session that left it listening.</p>
              <div className="row-right">
                <button className="btn" disabled={stopping} onClick={stop}>
                  {stopping ? 'Stopping…' : 'Stop listening'}
                </button>
              </div>
            </>
          )}
          {state === 'working' && (
            <>
              <p className="popover-title">Claude is working</p>
              <p>Its replies show up on each note and the new version lands in the versions list on its own.</p>
              {claude.listening && (
                <div className="row-right">
                  <button className="btn" disabled={stopping} onClick={stop}>
                    Stop listening
                  </button>
                </div>
              )}
            </>
          )}
          {state === 'away' && (
            <>
              <p className="popover-title">Claude is not listening</p>
              <p>
                In Claude Code, type <Command text="/creator-montage" /> so it keeps listening, or <Command text="/creator-notes" /> so it processes now what you already sent.
              </p>
            </>
          )}
          {state === 'no-server' && (
            <>
              <p className="popover-title">Montage is not responding</p>
              <p>
                In Claude Code, type <Command text="/creator-montage" />, or open the Montage app.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SendButton({ project, notes }: { project: string; notes: Note[] }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);
  const toSend = notes.filter((n) => TO_SEND.includes(n.state)).length;

  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener('montage:send', openIt);
    return () => window.removeEventListener('montage:send', openIt);
  }, []);

  const send = async () => {
    setSending(true);
    try {
      const r = await api.send(project, message.trim());
      setOpen(false);
      setMessage('');
      if (r.listening) notify(`Sent to Claude (${r.sent.length} note${r.sent.length === 1 ? '' : 's'}). It is already working.`, 'claude', undefined, 6000);
      else {
        navigator.clipboard?.writeText('/creator-notes').catch(() => {});
        notify('Sent. Claude is not listening: in Claude Code type /creator-notes (already copied).', 'info', undefined, 9000);
      }
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="popover-wrap" ref={ref}>
      <button className={cx('btn send', toSend ? 'primary' : 'no-notes')} onClick={() => setOpen(!open)} title="Send notes to Claude (Cmd+Enter)">
        <Send size={15} /> Send to Claude{toSend > 0 && <span className="badge">{toSend}</span>}
      </button>
      {open && (
        <div className="popover send-popover">
          <p className="popover-title">
            {toSend ? `${toSend} note${toSend === 1 ? '' : 's'} ready for Claude` : 'No new notes. You can send a general message.'}
          </p>
          <textarea
            rows={3}
            autoFocus
            placeholder="General message (optional): priorities, context, references…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
            }}
          />
          <p className="track">Claude also reads the project context and the brand rules.</p>
          <div className="row-right">
            <button className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" disabled={sending || (!toSend && !message.trim())} onClick={send}>
              <Send size={14} /> {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
