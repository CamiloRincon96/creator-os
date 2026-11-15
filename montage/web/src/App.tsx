import { useEffect, useState } from 'react';
import type { Mode } from './components/Header';
import { Toasts } from './components/Dialogs';
import { Home } from './components/Home';
import { ShutDownScreen, AskName } from './components/Session';
import { ProjectView } from './components/ProjectView';
import { setStore, useStore } from './state';
import { usePerson } from './person';

function route(): { view: 'project' | 'home'; id: string; mode: Mode } {
  const h = location.hash.replace(/^#\/?/, '');
  const m = /^p\/([a-z0-9-]+)(?:\/(edit|social))?/.exec(h);
  return m ? { view: 'project', id: m[1], mode: (m[2] as Mode) || 'review' } : { view: 'home', id: '', mode: 'review' };
}

export function App() {
  const [r, setR] = useState(route);
  const connected = useStore((s) => s.connected);
  const shutDown = useStore((s) => s.shutDown);
  const person = usePerson();
  useEffect(() => {
    const change = () => {
      const next = route();
      setR((previous) => {
        // Switching between Review and Edit of the same project keeps the selected version.
        if (previous.id !== next.id) setStore({ compare: null, selNote: null, draft: null, markIn: null, markOut: null });
        else setStore({ compare: null, draft: null });
        return next;
      });
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  if (shutDown) return <ShutDownScreen />;
  return (
    <>
      {!person ? <AskName /> : r.view === 'project' ? <ProjectView key={r.id} id={r.id} mode={r.mode} /> : <Home />}
      {!connected && <div className="offline" role="status">Reconnecting to Montage…</div>}
      <Toasts />
    </>
  );
}
