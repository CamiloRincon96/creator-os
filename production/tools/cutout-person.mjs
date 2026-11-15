// Stage 6: separates the person from the background in each block (@remotion/video-matting, modnet model, locally).
// Usage: node production/tools/cutout-person.mjs <piece> [B01 B02 …] [--remotion brands/example/reel] [--source v1|raw] [--test]
//
// For each block it reads image/blocks/B01-<source>.mp4 (or .mov) and leaves B01-<source>-front.webm (the person
// with transparency) next to it. The background is the same input file: it goes underneath, with its own effect.
// It is for the word behind the head, darkening or blurring the background and brightening only the person.
// --test only says whether this computer can do it.
import { pathToFileURL } from "node:url";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith("--")) {
  console.log("Usage: node production/tools/cutout-person.mjs <piece> [B01 B02 …] [--remotion brands/example/reel] [--source v1|raw] [--test]");
  process.exit(1);
}
const root = resolve(new URL("../..", import.meta.url).pathname);
const piece = resolve(root, args[0]);
const brandDir = resolve(piece, "..", "..");  // brands/<brand>
const remotion = args.includes("--remotion") ? join(root, args[args.indexOf("--remotion") + 1]) : join(brandDir, "reel");
const source = args.includes("--source") ? args[args.indexOf("--source") + 1] : "v1";
// The packages live in the brand's Remotion project: they are loaded from there, through their ESM entry.
const load = async (m) => {
  const dir = join(remotion, "node_modules", m);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const e = pkg.exports?.["."] ?? pkg.exports ?? {};
  const pick = (x) => (typeof x === "string" ? x : x?.import?.default ?? x?.import ?? x?.default ?? x?.node ?? null);
  const entry = pick(e) ?? pkg.module ?? pkg.main;
  return import(pathToFileURL(join(dir, typeof entry === "string" ? entry : entry.default)).href);
};

const { registerMediabunnyServer } = await load("@mediabunny/server");
const vm = await load("@remotion/video-matting");
registerMediabunnyServer();

const model = "modnet";
const support = await vm.canUseVideoMatting({ model });
console.log("Can this computer do the cutout?", support.supported ? "yes" : `no: ${support.detailedReason}`);
if (!support.supported || args.includes("--test")) process.exit(support.supported ? 0 : 1);

await vm.downloadVideoMattingModel({ model });
const blocks = JSON.parse(readFileSync(join(piece, "image", "blocks.json"), "utf8"));
const requested = args.filter((a) => /^B\d\d$/.test(a));
for (const b of blocks.filter((x) => requested.length === 0 || requested.includes(x.id))) {
  const src = [".mp4", ".mov"].map((e) => join(piece, "image", "blocks", `${b.id}-${source}${e}`)).find(existsSync);
  if (!src) {
    console.log(`${b.id}: ${b.id}-${source} is not there`);
    continue;
  }
  const start = Date.now();
  const r = await vm.separateVideoLayers({ src, model, audio: "none" });
  const front = await r.foreground.getBlob();
  const output = src.replace(/\.(mp4|mov)$/, "-front.webm");
  writeFileSync(output, Buffer.from(await front.arrayBuffer()));
  await r.base.dispose();
  await r.foreground.dispose();
  console.log(`${b.id}: ${r.processedFrames} frames in ${((Date.now() - start) / 1000).toFixed(0)} s -> ${basename(output)}`);
}
await vm.disposeVideoMattingModel({ model });
