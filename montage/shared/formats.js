// Social formats and safe zones. The brand measurements come from
// brands/<brand>/BRAND.md; the platform ones are approximate.

export const FORMATS = [
  { id: 'reel', name: 'Reel / Story 9:16', width: 1080, height: 1920 },
  { id: 'post', name: 'Post 4:5', width: 1080, height: 1350 },
  { id: 'square', name: 'Square 1:1', width: 1080, height: 1080 },
  { id: 'landscape', name: 'Landscape 16:9', width: 1920, height: 1080 },
  { id: 'fb-cover', name: 'Facebook cover', width: 1640, height: 624 },
  { id: 'yt-banner', name: 'YouTube banner', width: 2560, height: 1440 },
  { id: 'li-cover', name: 'LinkedIn cover', width: 1128, height: 191 },
];

export const BRANDS = [{ id: 'example', name: 'Example' }];

const close = (a, b) => Math.abs(a - b) < 0.02;

/**
 * Each zone describes, in pixels of a reference frame (ref), the areas to avoid
 * and the safe rectangle. They are scaled to the real frame size.
 */
export const SAFE_ZONES = [
  {
    id: 'brand',
    short: 'Brand',
    name: 'Brand safe zone',
    note: 'Text between y=230 and y=1440 and 230 px free on the right (BRAND.md)',
    applies: (w, h) => close(w / h, 9 / 16),
    ref: { width: 1080, height: 1920 },
    safe: { x: 0, y: 230, w: 850, h: 1210 },
    avoid: [
      { x: 0, y: 0, w: 1080, h: 230 },
      { x: 0, y: 1440, w: 1080, h: 480 },
      { x: 850, y: 230, w: 230, h: 1210 },
    ],
  },
  {
    id: 'reels',
    short: 'Reels',
    name: 'Instagram Reels (approx.)',
    note: 'Header on top, caption and audio at the bottom, buttons on the right',
    applies: (w, h) => close(w / h, 9 / 16),
    ref: { width: 1080, height: 1920 },
    safe: { x: 40, y: 220, w: 900, h: 1260 },
    avoid: [
      { x: 0, y: 0, w: 1080, h: 220, label: 'Header' },
      { x: 0, y: 1480, w: 1080, h: 440, label: 'Caption and audio' },
      { x: 940, y: 820, w: 140, h: 660, label: 'Buttons' },
    ],
  },
  {
    id: 'tiktok',
    short: 'TikTok',
    name: 'TikTok (approx.)',
    note: 'Tabs on top, text at the bottom, buttons on the right',
    applies: (w, h) => close(w / h, 9 / 16),
    ref: { width: 1080, height: 1920 },
    safe: { x: 40, y: 160, w: 880, h: 1260 },
    avoid: [
      { x: 0, y: 0, w: 1080, h: 160, label: 'Tabs' },
      { x: 0, y: 1420, w: 1080, h: 500, label: 'Text and audio' },
      { x: 920, y: 700, w: 160, h: 720, label: 'Buttons' },
    ],
  },
  {
    id: 'shorts',
    short: 'Shorts',
    name: 'YouTube Shorts (approx.)',
    note: 'Title at the bottom, buttons on the right',
    applies: (w, h) => close(w / h, 9 / 16),
    ref: { width: 1080, height: 1920 },
    safe: { x: 40, y: 140, w: 860, h: 1340 },
    avoid: [
      { x: 0, y: 0, w: 1080, h: 140 },
      { x: 0, y: 1480, w: 1080, h: 440, label: 'Title and channel' },
      { x: 900, y: 760, w: 180, h: 720, label: 'Buttons' },
    ],
  },
  {
    id: 'yt-banner',
    short: 'YouTube banner',
    name: 'YouTube banner',
    note: 'Safe zone 1546 × 423 in the center (PROFILE.md)',
    applies: (w, h) => close(w / h, 16 / 9) && w >= 2000,
    ref: { width: 2560, height: 1440 },
    safe: { x: 507, y: 508, w: 1546, h: 423 },
    avoid: [
      { x: 0, y: 0, w: 2560, h: 508 },
      { x: 0, y: 931, w: 2560, h: 509 },
      { x: 0, y: 508, w: 507, h: 423 },
      { x: 2053, y: 508, w: 507, h: 423 },
    ],
  },
  {
    id: 'fb-cover',
    short: 'Facebook cover',
    name: 'Facebook cover',
    note: 'On phones the sides are cropped: the 16:9 center stays (PROFILE.md: safe zone in the center)',
    applies: (w, h) => close(w / h, 1640 / 624),
    ref: { width: 1640, height: 624 },
    safe: { x: 265, y: 0, w: 1110, h: 624 },
    avoid: [
      { x: 0, y: 0, w: 265, h: 624 },
      { x: 1375, y: 0, w: 265, h: 624 },
    ],
  },
];

/** Zones that apply to a w × h frame. */
export function zonesFor(w, h) {
  return SAFE_ZONES.filter((z) => z.applies(w, h));
}
