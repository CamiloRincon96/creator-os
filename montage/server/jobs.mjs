// Long jobs (deliveries and exports) with live progress for the editor and the CLI.

import { EventEmitter } from 'node:events';

export const jobEvents = new EventEmitter();
const jobs = new Map();

export function newJob(data) {
  const j = { id: `T${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, progress: 0, stage: 'starting', done: false, error: null, files: [], ...data };
  jobs.set(j.id, j);
  return j;
}

export function notifyJob(j) {
  jobEvents.emit('job', { ...j });
}

export const readJob = (id) => jobs.get(id) || null;
