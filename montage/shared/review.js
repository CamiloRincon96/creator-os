// The quality lock (the creator, Nov 17, 2026: "make it super strict about going through the steps and following the
// plugin… score every version… an independent reviewer"). Reads the review report (REVIEW.md, written by
// production/tools/review.py --stage N) and says what's missing before an AI's version reaches the person:
// - "## What I saw" written and the "## Visual floor" resolved;
// - the stage and its lock: the stage's tools ran (review.py checks it against what they leave in the piece);
// - the independent reviewer's score (the reel-reviewer agent), 1 to 10 per axis, every axis at 8 or more, and its verdict.
// Strict but never a dead end: only the person can decide to skip something, and it's written down with their words.

export const MIN_SCORE = 8;

const noComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

/** The text of a section (## or ###) up to the next one of the same or higher level; null if it's missing. */
export function section(text, title) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => /^#{2,3}\s/.test(l) && l.replace(/^#+\s*/, '').trim().startsWith(title));
  if (i < 0) return null;
  const level = lines[i].match(/^#+/)[0].length;
  const end = lines.findIndex((l, j) => j > i && /^#+\s/.test(l) && l.match(/^#+/)[0].length <= level);
  return noComments(lines.slice(i + 1, end < 0 ? undefined : end).join('\n'));
}

export function readReview(text) {
  const whatISaw = (section(text, 'What I saw') || '').trim();
  const floorUnresolved = (section(text, 'Visual floor') || '').split('\n').map((l) => l.trim()).filter((l) => /^- \[ \]/.test(l) && !/\bn\/a\b|not applicable/i.test(l));
  const m = text.match(/^## Stage (\d+)\s*·?\s*(.*)$/m);
  const stage = m ? { n: Number(m[1]), name: m[2].trim() } : null;
  const lock = (section(text, 'Lock') || '').split('\n').map((l) => l.trim()).filter((l) => /^- \[[ x]\]/i.test(l));
  const lockPending = lock.filter((l) => /^- \[ \]/.test(l) && !/skipped/i.test(l)).map((l) => l.replace(/^- \[ \]\s*/, ''));
  const skipped = lock.filter((l) => /skipped/i.test(l)).map((l) => l.replace(/^- \[[ x]\]\s*/i, ''));
  const axes = [];
  for (const l of (section(text, 'Independent reviewer score') || '').split('\n')) {
    const c = l.match(/^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/);
    if (!c || /^axis$/i.test(c[1]) || /^:?-{2,}/.test(c[1])) continue;
    const n = Number(c[2].replace(',', '.'));
    axes.push({ axis: c[1], score: c[2] !== '' && Number.isFinite(n) && n >= 1 && n <= 10 ? n : null });
  }
  const scores = axes.map((a) => a.score).filter((n) => n !== null);
  const verdict = (section(text, 'Reviewer verdict') || '').trim();
  return {
    whatISaw,
    floorUnresolved,
    stage,
    lockPending,
    skipped,
    axes,
    average: scores.length ? Math.round((10 * scores.reduce((a, b) => a + b, 0)) / scores.length) / 10 : null,
    minimum: scores.length ? Math.min(...scores) : null,
    verdict,
  };
}

/** What keeps the version from being published (empty = it passes). showLow: the person decided to see it with an axis under 8. */
export function missing(r, { showLow = false } = {}) {
  const f = [];
  if (!r.whatISaw) f.push('"## What I saw" isn\'t written (what you looked at, what you found and what you fixed)');
  if (r.floorUnresolved.length) f.push(`${r.floorUnresolved.length} unresolved "## Visual floor" line(s) (tick them [x] after looking, or "n/a" and why)`);
  if (!r.stage) {
    f.push('the stage is missing: run review.py again with --stage N (the /creator-reel stage this version closes)');
    return f;
  }
  for (const c of r.lockPending) f.push(`stage ${r.stage.n} lock: ${c}`);
  if (!r.axes.length || r.axes.some((a) => a.score === null))
    f.push('the independent reviewer\'s score is missing: run the reel-reviewer agent on this report (it fills the 1-to-10 table)');
  else if (!showLow && r.minimum < MIN_SCORE)
    f.push(`axes under ${MIN_SCORE}: ${r.axes.filter((a) => a.score < MIN_SCORE).map((a) => `${a.axis} (${a.score})`).join(', ')}. Fix it and review again; only if the person decides to see it as is, --show-low "what they said"`);
  if (!r.verdict) f.push('the independent reviewer\'s verdict is missing (show or fix, and the 3 worst problems)');
  return f;
}
