// Short, stable fingerprint (the same in the browser and on the server) to name text/logo rasters.

export function fingerprint(text) {
  let a = 0x811c9dc5;
  let b = 0x9747b28c;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c, 2246822507);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

/**
 * Raster key of a timeline text or image clip: it changes when anything visible in the frame
 * changes. Opacity and fades are left out: ffmpeg applies them on export.
 */
export function rasterKey(clip, format) {
  const { opacity: _o, ...layer } = clip.layer || {};
  return fingerprint(JSON.stringify([format.width, format.height, clip.type, layer]));
}
