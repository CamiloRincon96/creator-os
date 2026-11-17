import { useEffect, type RefObject } from 'react';
import type { NoteState, NoteType } from './types';

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

/** Shortcut key in labels: Cmd on Mac, Ctrl on Windows and Linux (the shortcuts accept both). */
export const CMD = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? 'Cmd' : 'Ctrl';

export function ago(date: string | number | null | undefined) {
  if (!date) return '';
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 45) return 'now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

export const STATES: Record<NoteState, { text: string; className: string }> = {
  draft: { text: 'Draft', className: 'st-draft' },
  sent: { text: 'Sent', className: 'st-sent' },
  in_progress: { text: 'Claude working', className: 'st-progress' },
  question: { text: 'Claude asks', className: 'st-question' },
  resolved: { text: 'To verify', className: 'st-resolved' },
  approved: { text: 'Approved', className: 'st-approved' },
  reopened: { text: 'Reopened', className: 'st-reopened' },
};

export const TYPES: { id: NoteType; text: string }[] = [
  { id: 'change', text: 'Change' },
  { id: 'add', text: 'Add' },
  { id: 'remove', text: 'Remove' },
  { id: 'fix', text: 'Fix' },
  { id: 'idea', text: 'Idea' },
];

export const OPEN: NoteState[] = ['draft', 'sent', 'in_progress', 'question', 'reopened'];
export const TO_SEND: NoteState[] = ['draft', 'reopened'];

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

/** Is the focus on a text field? (so shortcuts do not fire while typing) */
export function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** "Today, 16:42", "Yesterday, 10:18" or "Oct 22, 09:12". */
export function shortDate(date: string | null | undefined) {
  if (!date) return '';
  const d = new Date(date);
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).replace('.', '')}, ${time}`;
}

/** Closes a popover on a click outside it or with Esc. */
export function useClickOutside(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('mousedown', outside);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('mousedown', outside);
      window.removeEventListener('keydown', key);
    };
  }, [ref, open, close]);
}
