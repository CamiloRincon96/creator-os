import { FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { notify, useStore } from '../state';
import type { Project } from '../types';
import { ago } from '../util';
import { authorName } from '../person';

type SaveState = 'saved' | 'changes' | 'saving' | 'error';

/**
 * The project brief (context.md). Claude reads it with every submission, along with the brand rules,
 * and can also update it from the CLI. It saves on its own while you type.
 */
export function ContextTab({ project }: { project: Project }) {
  const remote = useStore((s) => s.data?.context ?? '');
  const activity = useStore((s) => s.data?.activity);
  const [text, setText] = useState(remote);
  const [template, setTemplate] = useState('');
  const [rules, setRules] = useState<string[]>([]);
  const [state, setState] = useState<SaveState>('saved');
  const [conflict, setConflict] = useState(false);
  const base = useRef(remote);
  const timer = useRef(0);
  const lastChange = [...(activity ?? [])].reverse().find((a) => a.type === 'context');

  useEffect(() => {
    api
      .context(project.id)
      .then((c) => {
        setTemplate(c.template);
        setRules(c.rules);
      })
      .catch(() => {});
  }, [project.id]);

  // A new version arrives from disk (Claude or another person): it is applied if there are no local changes.
  useEffect(() => {
    if (remote === base.current) return;
    if (text === base.current) {
      base.current = remote;
      setText(remote);
    } else if (remote !== text) setConflict(true);
  }, [remote]);

  const save = async (value: string) => {
    window.clearTimeout(timer.current);
    if (value === base.current) return setState('saved');
    setState('saving');
    try {
      await api.saveContext(project.id, value);
      base.current = value;
      setState('saved');
      setConflict(false);
    } catch (e) {
      setState('error');
      notify(`The context was not saved: ${(e as Error).message}`, 'error');
    }
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const change = (value: string) => {
    setText(value);
    setState(value === base.current ? 'saved' : 'changes');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(value), 1200);
  };

  const label = {
    saved: lastChange ? `Saved · ${authorName(lastChange.author, lastChange.name)} ${ago(lastChange.date)}` : text ? 'Saved' : '',
    changes: 'Unsaved',
    saving: 'Saving…',
    error: 'Not saved: check the connection',
  }[state];

  return (
    <div className="context">
      <p className="context-intro">
        Claude reads this brief every time you send it notes. Write here what does not change between versions: goal, audience, tone, what it must have and what to avoid.
      </p>
      {conflict && (
        <div className="context-conflict" role="alert">
          <span>The context changed while you were typing.</span>
          <button
            className="btn small"
            onClick={() => {
              base.current = remote;
              setText(remote);
              setState('saved');
              setConflict(false);
            }}
          >
            See the new version
          </button>
          <button
            className="btn small"
            onClick={() => {
              base.current = remote;
              setConflict(false);
              save(text);
            }}
          >
            Keep mine
          </button>
        </div>
      )}
      {!text && template && (
        <button className="btn context-template" onClick={() => change(template)}>
          <FileText size={15} /> Start from the template
        </button>
      )}
      <textarea
        className="context-text"
        value={text}
        spellCheck
        aria-label="Project context"
        placeholder={'## Goal\nGet people to book the home installation…\n\n## Avoid\nPrices on screen…'}
        onChange={(e) => change(e.target.value)}
        onBlur={() => save(text)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            save(text);
          }
        }}
      />
      <div className="context-foot">
        <span className={`context-state ${state}`} aria-live="polite">
          {label}
        </span>
      </div>
      {rules.length > 0 && (
        <section className="context-rules">
          <h3>Claude also follows</h3>
          <ul>
            {rules.map((r) => (
              <li key={r}>
                <FileText size={13} />
                <code>{r}</code>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
