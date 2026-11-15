import { FolderOpen, PackageCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, deliverWithConflicts } from '../api';
import { notify, useStore } from '../state';
import type { DeliveryInfo, Project } from '../types';
import { Modal } from './Dialogs';

const DEFAULTS: Record<string, string[]> = {
  video: ['original', 'ig', 'fb'],
  image: ['original'],
  carousel: ['original'],
};

export function DeliverButton({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  if (!project.final) return null;
  return (
    <>
      <button className="btn deliver" onClick={() => setOpen(true)} title={`Deliver the final version ${project.final} with its variants`}>
        <PackageCheck size={15} /> Deliver {project.final}
      </button>
      {open && <DeliverDialog project={project} onClose={() => setOpen(false)} />}
    </>
  );
}

function DeliverDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const [info, setInfo] = useState<DeliveryInfo | null>(null);
  const [chosen, setChosen] = useState<string[]>(DEFAULTS[project.type]);
  const [folder, setFolder] = useState('');
  const [conflict, setConflict] = useState<string[] | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useStore((s) => (jobId ? s.jobs[jobId] : undefined));

  useEffect(() => {
    api
      .deliveryInfo(project.id)
      .then((i) => {
        setInfo(i);
        setFolder(i.folder);
      })
      .catch((e) => notify(e.message, 'error'));
  }, [project.id]);

  const send = async (overwrite = false) => {
    try {
      const r = await deliverWithConflicts(project.id, { variants: chosen, folder, overwrite });
      if ('conflict' in r) setConflict(r.conflict ?? []);
      else {
        setConflict(null);
        setJobId(r.job);
      }
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const running = !!jobId && !job?.done && !job?.error;

  return (
    <Modal title={`Deliver ${project.final} · ${project.name}`} onClose={onClose} width={560}>
      <div className="form">
        {!jobId && (
          <>
            <fieldset className="variants">
              <legend>Files to generate</legend>
              {info?.variants.map((v) => (
                <label key={v.id} className="checkbox variant">
                  <input
                    type="checkbox"
                    checked={chosen.includes(v.id)}
                    onChange={(e) => setChosen(e.target.checked ? [...chosen, v.id] : chosen.filter((x) => x !== v.id))}
                  />
                  <span>
                    <b>{v.name}</b> <small className="dim">{v.description}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <label>
              Folder (inside the repo)
              <input value={folder} onChange={(e) => setFolder(e.target.value)} />
            </label>
            {conflict && (
              <div className="conflict">
                <p>These files already exist and will be replaced:</p>
                <ul>
                  {conflict.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {info && info.deliveries.length > 0 && (
              <p className="track">
                Last delivery: {info.deliveries.at(-1)!.version} · {new Date(info.deliveries.at(-1)!.date).toLocaleString('en-US')}
              </p>
            )}
          </>
        )}
        {jobId && (
          <div className="delivery-progress">
            <div className="progress-bar">
              <span style={{ transform: `scaleX(${job?.progress || 0})` }} />
            </div>
            <p>{job?.error ? `Error: ${job.error}` : job?.done ? 'Delivery done.' : job?.stage || 'Starting…'}</p>
            {job?.done && (
              <ul className="chosen-list">
                {job.files.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <footer>
        {job?.done ? (
          <>
            <button className="btn" onClick={() => api.reveal(job.files[0])}>
              <FolderOpen size={14} /> Show in Finder
            </button>
            <button className="btn primary" onClick={onClose}>
              Done
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={onClose} disabled={running}>
              Cancel
            </button>
            {conflict ? (
              <button className="btn primary" onClick={() => send(true)}>
                Replace and deliver
              </button>
            ) : (
              <button className="btn primary" disabled={!chosen.length || running} onClick={() => send(false)}>
                {running ? 'Delivering…' : 'Deliver'}
              </button>
            )}
          </>
        )}
      </footer>
    </Modal>
  );
}
