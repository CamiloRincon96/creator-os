import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shapesBox, describeShape, describeRegion } from '../shared/shapes.js';
import { rasterKey } from '../shared/hash.js';
import { frameAt, frameMid, parseTime, ffmpegSeek, timecode, readableTime } from '../shared/time.js';

test('frames: the browser seeks to the middle of the frame and ffmpeg half a frame before', () => {
  assert.equal(frameAt(4.4, 30), 132);
  assert.equal(frameAt(frameMid(132, 30), 30), 132);
  assert.equal(frameAt(0, 30), 0);
  // -ss returns the first frame with pts >= ss: with (n - 0.5)/fps it lands exactly on n.
  assert.ok(ffmpegSeek(132, 30) < 132 / 30 && ffmpegSeek(132, 30) > 131 / 30);
  assert.equal(ffmpegSeek(0, 30), 0);
});

test('timecode and reading times', () => {
  assert.equal(timecode(4.4, 30), '00:00:04:12');
  assert.equal(timecode(3661.5, 24), '01:01:01:12');
  assert.equal(readableTime(4.4), '0:04.40');
  assert.equal(parseTime('4.4'), 4.4);
  assert.equal(parseTime('1:02.5'), 62.5);
  assert.equal(parseTime('00:00:04:12', 30), 4.4);
});

test('shapes: box, region and description for Claude', () => {
  const shapes = [
    { type: 'rect', x: 320, y: 140, w: 440, h: 280, color: '#f00' },
    { type: 'arrow', x1: 540, y1: 900, x2: 540, y2: 450, color: '#ff0' },
  ];
  assert.deepEqual(shapesBox(shapes), { x: 320, y: 140, w: 440, h: 760 });
  assert.equal(describeRegion({ x: 320, y: 140, w: 440, h: 280 }, 1080, 1920), 'top center');
  assert.equal(describeRegion({ x: 800, y: 1700, w: 100, h: 100 }, 1080, 1920), 'bottom right');
  assert.equal(describeShape(shapes[0]), 'rectangle x 320–760 · y 140–420');
  assert.match(describeShape(shapes[1]), /points at \(540, 450\)/);
  // A rectangle drawn "backwards" (negative w/h) is normalized.
  assert.deepEqual(shapesBox([{ type: 'rect', x: 500, y: 500, w: -100, h: -50 }]), { x: 400, y: 450, w: 100, h: 50 });
});

test('raster key: changes with what is visible, not with opacity or fades', () => {
  const format = { width: 1080, height: 1920, fps: 30 };
  const clip = { type: 'text', opacity: 1, fadeIn: 0, layer: { type: 'text', text: 'Hello', x: 10, opacity: 1 } };
  const a = rasterKey(clip, format);
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(rasterKey({ ...clip, opacity: 0.5, fadeIn: 1 }, format), a);
  assert.equal(rasterKey({ ...clip, layer: { ...clip.layer, opacity: 0.3 } }, format), a);
  assert.notEqual(rasterKey({ ...clip, layer: { ...clip.layer, text: 'Bye' } }, format), a);
  assert.notEqual(rasterKey(clip, { ...format, height: 1350 }), a);
});

const REPORT = (scores, extra = '') => `# Review of reel.mp4

## Visual floor

- [x] Real and specific.

## Stage 9 · Sound

### Lock

- [x] effects.py review on the final mix · work/effects/effects-v5/review.md
- [x] The piece's STATUS.md says stage 9
${extra}
### Independent reviewer score

| axis | score | proof |
|---|---|---|
${scores}

### Reviewer verdict

Show. The 3 worst: the paper at 34 s sits low.

## What I saw

I looked at everything.
`;

test('lock: passes with everything in order and says what is missing when not', async () => {
  const { missing, readReview } = await import('../shared/review.js');
  const good = readReview(REPORT('| sound hook | 9 | hit on frame 0 |\n| the voice is clear | 8.5 | Whisper 0.995 |'));
  assert.equal(good.stage.n, 9);
  assert.equal(good.average, 8.8);
  assert.equal(good.minimum, 8.5);
  assert.deepEqual(missing(good), []);
  // an axis under 8 doesn't pass, unless the person decides to see it as is
  const low = readReview(REPORT('| sound hook | 6 | can\'t hear it |\n| the voice is clear | 9 | |'));
  assert.equal(missing(low).length, 1);
  assert.match(missing(low)[0], /sound hook \(6\)/);
  assert.deepEqual(missing(low, { showLow: true }), []);
  // not scored, a tool that didn't run, or no stage: it doesn't pass
  assert.match(missing(readReview(REPORT('| sound hook | — | |'))).join(' '), /independent reviewer/);
  assert.match(missing(readReview(REPORT('| sound hook | 9 | |', '- [ ] faces.py check: nothing covers the face'))).join(' '), /stage 9 lock: faces\.py/);
  assert.deepEqual(missing(readReview(REPORT('| sound hook | 9 | |', '- [ ] faces.py check · skipped: the creator said "post it as is"'))), []);
  assert.match(missing(readReview('# Review\n\n## What I saw\n\nI looked at everything.\n')).join(' '), /--stage N/);
});
