import { Keyboard, Star } from 'lucide-react';
import { setStore, useStore } from '../state';
import type { Note, Project } from '../types';
import { cx } from '../util';
import { SendButton, ClaudePresence } from './Claude';
import { DeliverButton } from './Deliver';
import { ShutdownButton, PersonMenu } from './Session';

export type Mode = 'review' | 'edit' | 'social';

function Brand() {
  return (
    <a className="brand" href="#/" title="All projects">
      <picture>
        <source media="(max-width: 760px)" srcSet="/brand/montage-symbol.svg" />
        <img src="/brand/montage-logo.svg" alt="Montage" />
      </picture>
      <span className="brand-sep" aria-hidden />
      <span className="app-brand">Montage</span>
    </a>
  );
}

/** Home header: brand, Claude presence, who is reviewing and shut down. */
export function HomeHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="header">
      <div className="header-left">
        <Brand />
      </div>
      <span />
      <div className="header-right">
        <ClaudePresence />
        <PersonMenu />
        <ShutdownButton />
        {children}
      </div>
    </header>
  );
}

export function ProjectHeader({ project: p, notes, mode, withVersions }: { project: Project; notes: Note[]; mode: Mode; withVersions: boolean }) {
  const brands = useStore((s) => s.brands);
  const brand = brands.find((m) => m.id === p.brand)?.name || p.brand;
  const links: [Mode, string, string, string][] = [
    ['review', 'Review', '', 'Review versions and leave notes'],
    ['edit', 'Edit', '/edit', p.type === 'video' ? 'Video editor (timeline)' : 'Image editor'],
    ['social', 'Social', '/social', 'How it looks on Instagram, TikTok, YouTube and Facebook'],
  ];
  return (
    <header className="header">
      <div className="header-left">
        <Brand />
        <span className="crumb" aria-hidden>
          /
        </span>
        <div className="project-title">
          <h1 title={p.name}>{p.name}</h1>
          <span className="title-meta">
            {brand}
            {p.final && (
              <span className="chip-final">
                <Star size={10} fill="currentColor" /> FINAL {p.final}
              </span>
            )}
          </span>
        </div>
      </div>
      {withVersions ? (
        <nav className="modes" aria-label="Mode">
          {links.map(([id, text, path, title]) => (
            <a key={id} className={cx(mode === id && 'active')} href={`#/p/${p.id}${path}`} title={title} aria-current={mode === id ? 'page' : undefined}>
              {text}
            </a>
          ))}
        </nav>
      ) : (
        <span />
      )}
      <div className="header-right">
        <button className="ico" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={() => setStore({ help: true })}>
          <Keyboard size={17} />
        </button>
        <DeliverButton project={p} />
        <ClaudePresence />
        <PersonMenu />
        <ShutdownButton />
        <SendButton project={p.id} notes={notes} />
      </div>
    </header>
  );
}
