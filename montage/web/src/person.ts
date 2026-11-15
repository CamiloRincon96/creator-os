// Who is using Montage on this computer. Each person on the team signs their notes,
// versions and replies; the name travels in the x-montage-person header.

import { useSyncExternalStore } from 'react';

const KEY = 'montage:person';
const listeners = new Set<() => void>();
let current = saved();

function saved() {
  try {
    return localStorage.getItem(KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export const person = () => current;

export function setPerson(name: string) {
  current = name.trim().slice(0, 40);
  try {
    localStorage.setItem(KEY, current);
  } catch {}
  for (const fn of listeners) fn();
}

export function usePerson() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => current,
  );
}

export const personHeader = (): Record<string, string> => (current ? { 'x-montage-person': encodeURIComponent(current) } : {});

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '·';
}

/** Display name of whoever signed a version, a message or an activity line. */
export function authorName(author: string, name?: string) {
  if (author === 'claude') return 'Claude';
  if (author === 'creator') return 'the creator';
  return name || 'Team';
}
