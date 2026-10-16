// Renders the same looks with an older Texturizer and with this one, in the
// same browser, and checks the pixels are identical. New settings must leave
// every look made without them exactly as it was: translator keeps reveal
// faces made by the older renderer, and the house look is one of them.
//
//   npm run check:pixels                # against 04d142d (translator's copy)
//   BASE=<commit> npm run check:pixels  # against another commit
//
// The older files come from git (`git show`), with the element renamed so
// both can be defined on one page. Covers each of the nine original styles
// with its own defaults, the switches and effects, colour masks, the real
// preset files in test/fixtures, a full-size render, and the preview path.

import { ROOT, gitShow, report, runPage } from "./lib/headless.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE || "04d142d";
const FIXTURES = ["01", "02", "03", "04"];

const routes = {
  "/base/src/canvas-filter.js": () => {
    const source = gitShow(BASE, "src/canvas-filter.js").toString("utf8");
    const renamed = source.replace('const TAG_NAME = "texturize-filter";', 'const TAG_NAME = "texturize-filter-base";');
    if (renamed === source) throw new Error(`Could not rename the element at ${BASE}.`);
    return renamed;
  },
  "/base/src/preset.js": () => gitShow(BASE, "src/preset.js"),
  "/samples/A.jpg": () => readFileSync(join(ROOT, "samples/A.jpg")),
  "/samples/B.jpg": () => readFileSync(join(ROOT, "samples/B.jpg"))
};
for (const name of FIXTURES) {
  routes[`/fixtures/${name}.json`] = () => readFileSync(join(ROOT, `test/fixtures/presets/${name}.json`));
}

const script = String.raw`
const { defaultParams } = await import("/base/src/preset.js");
await import("/base/src/canvas-filter.js");
await import("/src/canvas-filter.js");

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });
const progress = (text) => fetch("/log", { method: "POST", body: JSON.stringify({ progress: text }) });

function mount(tag) {
  const el = document.createElement(tag);
  el.setAttribute("persist", "off");
  document.body.appendChild(el);
  return el;
}
const base = mount("texturize-filter-base");
const next = mount("texturize-filter");
await Promise.all([base.ready(), next.ready()]);

async function pixels(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
}
function compare(a, b) {
  if (a.length !== b.length) return { same: false, detail: "sizes differ" };
  let differing = 0;
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d) {
      differing++;
      if (d > worst) worst = d;
    }
  }
  return { same: differing === 0, detail: differing ? differing + " values differ, by up to " + worst : "" };
}

const blob = async (path) => (await fetch(path)).blob();
const pictures = { A: await blob("/samples/A.jpg"), B: await blob("/samples/B.jpg") };

const noMasks = () => ({ exclude: [], include: [], excludeAll: false });
const preset = (params, masks = noMasks()) => ({
  format: "texturizer-preset", version: 1, name: "check", exported: "2026-10-16T00:00:00Z", build: "check",
  params: { ...defaultParams(), ...params }, masks
});

const cases = [];
const STYLES = ["Canvas", "Paper", "Ink Wash", "Clay", "Linocut", "Leather", "Slate", "Mosaic", "Canvas 2"];
STYLES.forEach((style, i) => cases.push([style + " with its defaults", preset({ texturetype: i, ...base.styleDefaults[i] })]));
cases.push(["Canvas, distressed and dye bleed", preset({ texturetype: 0, distressed: 1, dyebleed: 1 })]);
cases.push(["Ink Wash, dye bleed", preset({ texturetype: 2, ...base.styleDefaults[2], dyebleed: 1 })]);
cases.push(["Clay distressed", preset({ texturetype: 3, distressed: 1 })]);
cases.push(["Leather distressed", preset({ texturetype: 5, distressed: 1 })]);
cases.push(["Mosaic distressed", preset({ texturetype: 7, distressed: 1 })]);
cases.push(["Canvas 2 distressed, soft", preset({ texturetype: 8, distressed: 1, soften: 0.8 })]);
cases.push(["Paper distressed", preset({ texturetype: 1, distressed: 1 })]);
cases.push(["every effect at once", preset({
  texturetype: 1, halftone: 0.6, sharpness: 0.5, vignette: 0.5, washintensity: 0.4, washcolor: "#2266aa",
  shininess: 0.5, colorscale: 0.5, colordepth: -0.5, warp: 0.5, preserveskin: 1, lighttint: -0.5,
  papertint: 0.5, saturation: 1.5, brightness: 1.4, contrast: 1.3, angle: 30, lightazimuth: -40, lightelevation: 20
})]);
cases.push(["colour masks", preset({ texturetype: 0 }, {
  exclude: [{ r: 0, g: 0, b: 0 }, { r: 242, g: 208, b: 22 }], include: [{ r: 255, g: 255, b: 255 }], excludeAll: false
})]);
cases.push(["exclude all, include one", preset({ texturetype: 3 }, {
  exclude: [], include: [{ r: 71, g: 100, b: 118 }], excludeAll: true
})]);
for (const name of ${JSON.stringify(FIXTURES)}) {
  cases.push(["preset file " + name, await (await fetch("/fixtures/" + name + ".json")).json()]);
}

for (const [name, look] of cases) {
  base.applyPreset(look);
  const applied = next.applyPreset(look);
  check(name + ": the new build takes it without a warning", applied.warnings.length === 0, applied.warnings.join(" "));
  for (const [picture, source] of Object.entries(pictures)) {
    const a = await pixels((await base.renderBlob(source, { width: 300, height: 420 })).blob);
    const b = await pixels((await next.renderBlob(source, { width: 300, height: 420 })).blob);
    const { same, detail } = compare(a, b);
    check(name + ", picture " + picture + ": identical pixels", same, detail);
  }
  progress("  rendered " + name);
}

// Full size, the house look.
{
  const look = cases[cases.length - 1][1];
  base.applyPreset(look);
  next.applyPreset(look);
  const a = await pixels((await base.renderBlob(pictures.A)).blob);
  const b = await pixels((await next.renderBlob(pictures.A)).blob);
  const { same, detail } = compare(a, b);
  check("house look at full size (1500 x 2100): identical pixels", same, detail);
}

// The preview path: the panel's own picture, texture and canvas.
{
  const dataUrl = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(pictures.B);
  });
  const loaded = (el) => new Promise((resolve) => el.addEventListener("filter-ready", resolve, { once: true }));
  const waits = [loaded(base), loaded(next)];
  base.setAttribute("image-data", dataUrl);
  next.setAttribute("image-data", dataUrl);
  await Promise.all(waits);
  await new Promise((r) => setTimeout(r, 500));
  const read = (el) => {
    el.renderCanvas();
    const gl = el.gl;
    const out = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return out;
  };
  const a = read(base);
  const b = read(next);
  const { same, detail } = compare(a, b);
  check("the preview, house look: identical pixels (" + base.glCanvas.width + " x " + base.glCanvas.height + ")",
    same && base.glCanvas.width === next.glCanvas.width && base.glCanvas.height === next.glCanvas.height, detail);
}

await fetch("/log", { method: "POST", body: JSON.stringify({ done: true, results }) });
`;

console.log(`Comparing with ${BASE}.`);
const results = await runPage({ script, routes });
process.exit(report(results) ? 1 : 0);
