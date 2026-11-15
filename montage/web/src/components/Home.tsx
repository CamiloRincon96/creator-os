import { Film, Images, Image as ImageIcon, Plus, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from '../state';
import { authorName } from '../person';
import type { Summary } from '../types';
import { ago } from '../util';
import { refreshSummaries } from '../live';
import { HomeHeader } from './Header';
import { NewProject } from './Dialogs';

export function Home() {
  const summaries = useStore((s) => s.summaries);
  const brands = useStore((s) => s.brands);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    refreshSummaries().catch(() => {});
  }, []);

  const groups = new Map<string, Summary[]>();
  for (const r of [...summaries].sort((a, b) => b.updated.localeCompare(a.updated))) {
    const k = r.brand || 'others';
    groups.set(k, [...(groups.get(k) || []), r]);
  }
  const brandName = (id: string) => brands.find((m) => m.id === id)?.name || (id === 'others' ? 'No brand' : id);

  const attention = summaries
    .map((r) => ({ r, question: r.notes.question || 0, verify: r.notes.resolved || 0, drafts: (r.notes.draft || 0) + (r.notes.reopened || 0) }))
    .filter((x) => x.question || x.verify || x.drafts);

  return (
    <div className="home">
      <HomeHeader>
        <button className="btn primary" onClick={() => setCreating(true)}>
          <Plus size={15} /> New project
        </button>
      </HomeHeader>
      <div className="home-body">

      {attention.length > 0 && (
        <section className="attention">
          <h2>Waiting for you</h2>
          <ul>
            {attention.map(({ r, question, verify, drafts }) => (
              <li key={r.id}>
                <a href={`#/p/${r.id}`}>
                  <b>{r.name}</b>
                  {question > 0 && <span className="state st-question">{question} question{question === 1 ? '' : 's'} from Claude</span>}
                  {verify > 0 && <span className="state st-resolved">{verify} to verify</span>}
                  {drafts > 0 && <span className="state st-draft">{drafts} unsent</span>}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {[...groups.entries()].map(([brand, list]) => (
        <section key={brand} className="brand-group">
          <h2>{brandName(brand)}</h2>
          <div className="grid">
            {list.map((r) => (
              <ProjectCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      ))}

      {!summaries.length && (
        <div className="welcome">
          <img src="/brand/montage-symbol.svg" alt="" />
          <h2>All the results will land here</h2>
          <p>
            Every render Claude makes is published as a version. You review, point at the frame and the area, comment and send Claude the list of changes. When a version is right, you mark it as FINAL.
          </p>
          <button className="btn primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> Create the first project
          </button>
        </div>
      )}
      </div>
      {creating && <NewProject onClose={() => setCreating(false)} />}
    </div>
  );
}

function ProjectCard({ r }: { r: Summary }) {
  const Icon = r.type === 'video' ? Film : r.type === 'carousel' ? Images : ImageIcon;
  const open = (r.notes.sent || 0) + (r.notes.in_progress || 0);
  const questions = r.notes.question || 0;
  const unsent = (r.notes.draft || 0) + (r.notes.reopened || 0);
  return (
    <a className="card" href={`#/p/${r.id}`}>
      <div className="card-poster">
        {r.poster ? <img src={r.poster} alt="" loading="lazy" /> : <Icon size={28} className="dim" />}
        {r.final && (
          <span className="final-stamp">
            <Star size={10} fill="currentColor" /> FINAL {r.final}
          </span>
        )}
        <span className="card-type">
          <Icon size={12} />
          {r.last?.id || '—'}
        </span>
      </div>
      <div className="card-info">
        <h3>{r.name}</h3>
        <p className="dim small">
          {r.last ? (
            <>
              {authorName(r.last.author, r.last.name)} · {ago(r.last.created)}
              {r.format?.width ? ` · ${r.format.width}×${r.format.height}` : ''}
            </>
          ) : (
            'No versions'
          )}
        </p>
        <div className="chips">
          {questions > 0 && <span className="state st-question">{questions} question{questions === 1 ? '' : 's'}</span>}
          {open > 0 && <span className="state st-progress">{open} with Claude</span>}
          {(r.notes.resolved || 0) > 0 && <span className="state st-resolved">{r.notes.resolved} to verify</span>}
          {unsent > 0 && <span className="state st-draft">{unsent} unsent</span>}
        </div>
      </div>
    </a>
  );
}
