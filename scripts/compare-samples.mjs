// Renders samples/A.jpg and samples/B.jpg with a look, at the samples' size
// (480 x 672) and at full size, so they can be held against the wanted
// reveal faces samples/A2.PNG and B2.PNG (see docs/plans/concrete-lighten.md).
//
//   node scripts/compare-samples.mjs <look.json> [outDir]
//   python -I samples/measure.py <outDir>
//
// <look.json> is a preset file, or { "params": { ... } } with only the
// settings that differ from the defaults. Writes <outDir>/A-480.png,
// A-full.png, A-full-480.png (full size scaled down in the browser), and the
// same for B. outDir defaults to samples/out (not committed). QUICK=1 skips
// the full-size renders.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT, runPage } from "./lib/headless.mjs";

const [lookPath, outArg] = process.argv.slice(2);
if (!lookPath) {
  console.log("usage: node scripts/compare-samples.mjs <look.json> [outDir]");
  process.exit(1);
}
const look = JSON.parse(readFileSync(resolve(lookPath), "utf8"));
const outDir = resolve(outArg || join(ROOT, "samples", "out"));

const routes = {
  "/samples/A.jpg": () => readFileSync(join(ROOT, "samples/A.jpg")),
  "/samples/B.jpg": () => readFileSync(join(ROOT, "samples/B.jpg"))
};

const script = String.raw`
const { defaultParams, validatePreset } = await import("/src/preset.js");
await import("/src/canvas-filter.js");
const look = ${JSON.stringify(look)};
const save = (name, dataUrl) => fetch("/log", { method: "POST", body: JSON.stringify({ save: name, dataUrl }) });

const el = document.createElement("texturize-filter");
el.setAttribute("persist", "off");
document.body.appendChild(el);
await el.ready();

const preset = look.format ? look : {
  format: "texturizer-preset", version: 1, name: "compare", exported: "2026-10-16T00:00:00Z", build: "compare",
  params: { ...defaultParams(), ...look.params },
  masks: look.masks || { exclude: [], include: [], excludeAll: false }
};
const { warnings } = el.applyPreset(preset);

const asDataUrl = (blob) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
async function shrink(blob, width, height) {
  const bitmap = await createImageBitmap(blob, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  return new Promise((r) => canvas.toBlob(r, "image/png"));
}

for (const name of ["A", "B"]) {
  const source = await (await fetch("/samples/" + name + ".jpg")).blob();
  const small = await el.renderBlob(source, { width: 480, height: 672 });
  await save(name + "-480.png", await asDataUrl(small.blob));
  if (${JSON.stringify(!process.env.QUICK)}) {
    const full = await el.renderBlob(source);
    await save(name + "-full.png", await asDataUrl(full.blob));
    await save(name + "-full-480.png", await asDataUrl(await shrink(full.blob, 480, 672)));
  }
}

await fetch("/log", { method: "POST", body: JSON.stringify({ done: true, results: [
  { name: "rendered with settings hash " + el.currentSettingsHash(), ok: true, detail: warnings.join(" ") }
] }) });
`;

const results = await runPage({ script, routes, outDir });
for (const r of results) console.log(r.name + (r.detail ? "  (" + r.detail + ")" : ""));
console.log("Written to " + outDir);
