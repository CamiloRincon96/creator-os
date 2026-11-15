import { ChevronRight, File as FileIcon, Film, Folder, Image as ImageIcon, Music, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, upload } from '../api';
import type { RepoEntry } from '../types';
import { bytes, cx } from '../util';

const ICONS = {
  folder: <Folder size={15} />,
  video: <Film size={15} />,
  image: <ImageIcon size={15} />,
  audio: <Music size={15} />,
  other: <FileIcon size={15} />,
};

/** File selection: drag and drop or pick from the repo. Returns paths for /versions. */
export interface Selection {
  local: File[];
  repo: string[];
}

export function FilePicker({ value, onChange, multiple = true }: { value: Selection; onChange: (s: Selection) => void; multiple?: boolean }) {
  const [mode, setMode] = useState<'drop' | 'repo'>('drop');
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const addLocal = (files: File[]) => onChange({ local: multiple ? [...value.local, ...files] : files.slice(0, 1), repo: multiple ? value.repo : [] });

  return (
    <div className="file-picker">
      <div className="tabs">
        <button className={cx(mode === 'drop' && 'active')} onClick={() => setMode('drop')}>
          From the computer
        </button>
        <button className={cx(mode === 'repo' && 'active')} onClick={() => setMode('repo')}>
          From the repo (existing renders)
        </button>
      </div>
      {mode === 'drop' ? (
        <div
          className={cx('drop-zone', over && 'on-top')}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            addLocal([...e.dataTransfer.files]);
          }}
          onClick={() => input.current?.click()}
        >
          <Upload size={20} />
          <span>Drag videos or images here, or click to choose</span>
          <input ref={input} type="file" hidden multiple={multiple} accept="video/*,image/*" onChange={(e) => addLocal([...(e.target.files || [])])} />
        </div>
      ) : (
        <RepoBrowser selection={value.repo} onChange={(repo) => onChange({ local: multiple ? value.local : [], repo: multiple ? repo : repo.slice(-1) })} />
      )}
      {(value.local.length > 0 || value.repo.length > 0) && (
        <ul className="chosen-list">
          {value.local.map((f, i) => (
            <li key={`l${i}`}>
              {f.name} <small>{bytes(f.size)}</small>
              <button onClick={() => onChange({ ...value, local: value.local.filter((_, j) => j !== i) })}>remove</button>
            </li>
          ))}
          {value.repo.map((r) => (
            <li key={r}>
              {r}
              <button onClick={() => onChange({ ...value, repo: value.repo.filter((x) => x !== r) })}>remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RepoBrowser({ selection, onChange }: { selection: string[]; onChange: (r: string[]) => void }) {
  const [dir, setDir] = useState('');
  const [entries, setEntries] = useState<RepoEntry[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .repo(dir)
      .then((r) => {
        setEntries(r.entries);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [dir]);
  const parts = dir ? dir.split('/') : [];
  return (
    <div className="browser">
      <div className="crumbs">
        <button onClick={() => setDir('')}>creator-os</button>
        {parts.map((p, i) => (
          <span key={i}>
            <ChevronRight size={12} />
            <button onClick={() => setDir(parts.slice(0, i + 1).join('/'))}>{p}</button>
          </span>
        ))}
      </div>
      {error && <p className="error-small">{error}</p>}
      <ul className="entries">
        {entries
          .filter((e) => e.type !== 'other' && e.type !== 'audio' && !(dir === '' && e.name === 'montage'))
          .map((e) => {
            const chosen = selection.includes(e.path);
            return (
              <li key={e.path}>
                <button
                  className={cx('entry', chosen && 'chosen')}
                  onClick={() => (e.type === 'folder' ? setDir(e.path) : onChange(chosen ? selection.filter((x) => x !== e.path) : [...selection, e.path]))}
                >
                  {ICONS[e.type]}
                  <span className="name">{e.name}</span>
                  {e.type !== 'folder' && <small>{bytes(e.size)}</small>}
                </button>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

/** Uploads the local files and gathers all the paths to create the version. */
export async function pathsFromSelection(s: Selection, onProgress?: (text: string) => void) {
  const paths: string[] = [...s.repo];
  for (let i = 0; i < s.local.length; i++) {
    const f = s.local[i];
    paths.push(await upload(f, (p) => onProgress?.(`Uploading ${f.name} · ${Math.round(p * 100)}%`)));
  }
  return paths;
}

export function selectionType(s: Selection): 'video' | 'image' | 'carousel' {
  const names = [...s.local.map((f) => f.name), ...s.repo];
  const images = names.filter((n) => /\.(png|jpe?g|webp|gif)$/i.test(n)).length;
  if (images === 0) return 'video';
  return images > 1 ? 'carousel' : 'image';
}
