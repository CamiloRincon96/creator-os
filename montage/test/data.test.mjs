// Tests the data layer on a temporary folder (does not touch montage/projects).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'montage-test-'));
process.env.MONTAGE_PROJECTS = path.join(tmp, 'projects');
process.env.MONTAGE_STATE = path.join(tmp, 'state');
process.env.MONTAGE_CACHE = path.join(tmp, 'cache');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = await import('../server/data.mjs');
const { validateTimeline } = await import('../server/export.mjs');

// A small real image from the repo to version (ffprobe has to be able to read it).
const IMAGE = path.join(ROOT, 'web', 'public', 'brand', 'app-icon-1024.png'); // it is in git: the test runs on a fresh clone

before(() => fs.mkdirSync(process.env.MONTAGE_PROJECTS, { recursive: true }));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('project, cloned versions and numbering', async () => {
  const p = await data.createProject({ id: 'test', name: 'Test', brand: 'example', type: 'image' });
  assert.equal(p.delivery.folder, 'brands/example/finals/test');
  await assert.rejects(data.createProject({ id: 'test', name: 'Other' }), /already exists/);

  const v1 = await data.addVersion('test', { files: [IMAGE], author: 'claude', note: 'first' });
  const v2 = await data.addVersion('test', { files: [IMAGE], author: 'creator', created: '2026-01-02T03:04:05Z' });
  assert.equal(v1.id, 'v1');
  assert.equal(v2.id, 'v2');
  assert.equal(v2.created, '2026-01-02T03:04:05.000Z');
  const file = path.join(data.projectDir('test'), v1.files[0].path);
  assert.ok(fs.existsSync(file));
  // The version is read-only so nobody overwrites it.
  assert.equal(fs.statSync(file).mode & 0o222, 0);
  assert.equal(v1.files[0].meta.width, 1024);

  const withFinal = await data.markFinal('test', 'v1');
  assert.equal(withFinal.final, 'v1');
  assert.equal(withFinal.versions.find((v) => v.id === 'v1').state, 'final');
  const otherFinal = await data.markFinal('test', 'v2');
  assert.equal(otherFinal.versions.filter((v) => v.state === 'final').length, 1);
});

test('notes: draft → sent → in progress → resolved → approved / reopened', async () => {
  await data.createProject({ id: 'notes', name: 'Notes', type: 'image' });
  await data.addVersion('notes', { files: [IMAGE] });
  const a = await data.createNote('notes', { text: 'Move the logo up', type: 'change', shapes: [{ type: 'rect', x: 1, y: 2, w: 3, h: 4 }] });
  const b = await data.createNote('notes', { text: 'Something else', type: 'remove' });
  assert.deepEqual([a.n, b.n], [1, 2]);
  assert.equal(a.state, 'draft');

  const { notes } = await data.sendNotes('notes');
  assert.deepEqual(notes.map((n) => n.state), ['sent', 'sent']);
  await assert.rejects(data.sendNotes('notes'), /There are no notes to send/);

  const [r] = await data.replyToNotes('notes', [1], { text: 'Plan: move it up', state: 'in_progress' });
  assert.equal(r.state, 'in_progress');
  assert.equal(r.thread.at(-1).author, 'claude');

  const v2 = await data.addVersion('notes', { files: [IMAGE], resolves: [1] });
  const resolved = await data.readNote('notes', 1);
  assert.equal(resolved.state, 'resolved');
  assert.equal(resolved.resolvedIn, v2.id);

  assert.equal((await data.editNote('notes', 1, { state: 'approved' })).state, 'approved');
  // Commenting on a closed note reopens it for the next submission.
  assert.equal((await data.editNote('notes', 1, { message: 'It still needs centering' })).state, 'reopened');
  await assert.rejects(data.editNote('notes', 2, { state: 'approved' }), /cannot go from/);
  await assert.rejects(data.deleteNote('notes', 2), /Only draft notes can be deleted/);
});

test('a message without notes creates a general note', async () => {
  await data.createProject({ id: 'message', name: 'Message', type: 'image' });
  const r = await data.sendNotes('message', { message: 'Try another palette' });
  assert.equal(r.notes.length, 1);
  assert.equal(r.notes[0].text, 'Try another palette');
  assert.equal(r.notes[0].state, 'sent');
});

test('timeline validation', () => {
  assert.deepEqual(validateTimeline({ format: { width: 1080, height: 1920, fps: 30 }, tracks: [{ id: 'V1' }], clips: [] }), []);
  const problems = validateTimeline({
    format: { width: 1080, height: 1920, fps: 30 },
    tracks: [{ id: 'V1' }],
    clips: [
      { id: 'a', track: 'V9', type: 'video', path: 'x.mp4', start: 0, duration: 1, sourceIn: 0, speed: 1 },
      { id: 'b', track: 'V1', type: 'audio', path: 'y.wav', start: -1, duration: 0, sourceIn: 0, speed: 0 },
      { id: 'c', track: 'V1', type: 'magic', start: 0, duration: 1 },
    ],
  });
  assert.equal(problems.length, 5);
  assert.match(problems.join(' | '), /track "V9" does not exist/);
  assert.match(problems.join(' | '), /unknown type/);
});

test('archive: deletes the files of the versions that are not the FINAL and keeps the history', async () => {
  await data.createProject({ id: 'archive', name: 'Archive', brand: 'example', type: 'image' });
  for (let i = 0; i < 3; i++) await data.addVersion('archive', { files: [IMAGE], author: 'claude', note: `v${i + 1}` });
  // Without a FINAL and without keep it deletes nothing.
  await assert.rejects(data.archiveVersions('archive'), /FINAL/);
  await data.markFinal('archive', 'v2');
  const dry = await data.archiveVersions('archive', { dryRun: true });
  assert.equal(dry.dryRun, true);
  assert.deepEqual(dry.plan.map((x) => x.version), ['v1', 'v3']);
  assert.ok(fs.existsSync(path.join(data.projectDir('archive'), 'versions', 'v1')));
  const done = await data.archiveVersions('archive');
  assert.equal(done.dryRun, false);
  assert.ok(done.bytes > 0);
  assert.ok(!fs.existsSync(path.join(data.projectDir('archive'), 'versions', 'v1')));
  assert.ok(fs.existsSync(path.join(data.projectDir('archive'), 'versions', 'v2')));
  const p = await data.readProject('archive');
  assert.equal(p.versions.length, 3);
  assert.ok(p.versions.find((v) => v.id === 'v1').archived);
  assert.equal(p.versions.find((v) => v.id === 'v1').files[0].archived, true);
  assert.equal(p.versions.find((v) => v.id === 'v2').archived, undefined);
  // A second pass has nothing to do.
  assert.equal((await data.archiveVersions('archive')).plan.length, 0);
});
