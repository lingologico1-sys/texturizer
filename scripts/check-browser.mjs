// Checks the component in headless Chrome (software WebGL): the renderer API
// a host app relies on (ready, applyPreset, getPreset, renderBlob, dispose),
// embedded mode (persist="off"), presets carrying masks, and the mask preview
// staying out of exports.
//
//   npm run check:browser
//
// The source files are served as they are, unbundled, which is also how a
// host app loads its pinned copy. Set CHROME to the browser to use; otherwise
// the usual install paths (see scripts/lib/headless.mjs), then a Playwright
// Chromium from ~/.cache/ms-playwright. Software rendering proves function,
// not speed.

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT, findChrome } from "./lib/headless.mjs";

const pageScript = String.raw`
import { validatePreset, settingsHash, defaultParams } from "/src/preset.js";

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });
const rejects = async (promise) => promise.then(() => null, (e) => e);

// Count every touch of this origin's storage.
const storage = { local: 0, idb: 0 };
for (const method of ["getItem", "setItem", "removeItem", "clear", "key"]) {
  const original = Storage.prototype[method];
  Storage.prototype[method] = function (...args) {
    storage.local++;
    return original.apply(this, args);
  };
}
const originalOpen = IDBFactory.prototype.open;
IDBFactory.prototype.open = function (...args) {
  storage.idb++;
  return originalOpen.apply(this, args);
};

await import("/src/canvas-filter.js");
await customElements.whenDefined("texturize-filter");

function picture(width, height, hue) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "hsl(" + hue + ", 70%, 60%)");
  gradient.addColorStop(1, "hsl(" + (hue + 120) + ", 70%, 40%)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#000000";
  ctx.fillRect(width * 0.2, height * 0.2, width * 0.3, height * 0.2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(width * 0.55, height * 0.6, width * 0.3, height * 0.2);
  return canvas;
}
const toBlob = (canvas, type = "image/png") => new Promise((r) => canvas.toBlob(r, type));

async function pixels(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  return { width: bitmap.width, height: bitmap.height, data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data };
}
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function mount(attributes = {}) {
  const el = document.createElement("texturize-filter");
  for (const [k, v] of Object.entries(attributes)) el.setAttribute(k, v);
  document.body.appendChild(el);
  return el;
}

const source = await toBlob(picture(280, 385, 20));
const sourcePixels = await pixels(source);

// ---- Embedded mode first, while the storage counters are still at zero ----
{
  const el = mount({ persist: "off" });
  await el.ready();
  check("ready() resolves with a linked program", !!el.program);

  const preset = el.getPreset("House");
  preset.params.texturetype = 3;
  preset.params.depth = 0.9;
  preset.masks.exclude.push({ r: 0, g: 0, b: 0 });
  const applied = el.applyPreset(preset);
  check("applyPreset returns the hash of what it applied",
    applied.settingsHash === validatePreset(preset).settingsHash && applied.settingsHash === el.currentSettingsHash());

  let events = 0;
  el.addEventListener("settings-change", () => events++);
  el.setAttribute("scale", "50");
  el.addPickedColor({ r: 255, g: 255, b: 255 }, "include");
  await new Promise((r) => setTimeout(r, 0));
  check("a settings-change event follows a change", events === 1, events);

  // The same look, exported twice, and carried to a fresh element.
  const first = el.getPreset("A");
  const second = el.getPreset("B");
  check("exporting the same settings twice gives the same hash",
    validatePreset(first).settingsHash === validatePreset(second).settingsHash);
  const other = mount({ persist: "off" });
  await other.ready();
  other.applyPreset(JSON.parse(JSON.stringify(first)));
  const carried = other.getPreset("A");
  check("export then import elsewhere: same settings, masks and hash",
    JSON.stringify(carried.params) === JSON.stringify(first.params)
      && JSON.stringify(carried.masks) === JSON.stringify(first.masks)
      && other.currentSettingsHash() === el.currentSettingsHash());
  other.dispose();

  const before = el.currentSettingsHash();
  const bad = el.getPreset("Bad");
  bad.params.texturetype = 10;
  let threw = false;
  try { el.applyPreset(bad); } catch (e) { threw = true; }
  check("a refused preset throws and changes nothing", threw && el.currentSettingsHash() === before);

  const out = await el.renderBlob(source, { type: "image/png" });
  const outPixels = await pixels(out.blob);
  check("renderBlob gives a picture of the source's own size",
    out.width === 280 && out.height === 385 && outPixels.width === 280 && outPixels.height === 385,
    outPixels.width + "x" + outPixels.height);
  check("the render is not blank and is not the untouched source",
    outPixels.data.some((v) => v !== 0) && !same(outPixels.data, sourcePixels.data));
  check("the panel has no picture after rendering one for a host", el.image === null && !el.hasAttribute("data-has-image"));

  const display = (id) => getComputedStyle(el.shadowRoot.querySelector(id)).display;
  check("embedded: file picker, presets, batch, download and the title are hidden",
    display(".file-picker") === "none" && display(".presets-container") === "none" && display(".download-button") === "none"
      && display(".title") === "none" && display(".subtitle") === "none" && display(".reset-button") !== "none");
  el.handleFileChange({ target: { files: [new File([source], "x.png", { type: "image/png" })] } });
  await new Promise((r) => setTimeout(r, 300));
  check("embedded: the file handler cannot replace the picture", el.image === null);
  el.resetControls();
  el.handleSavePreset();

  el.dispose();
  check("embedded: no storage was read or written", storage.local === 0 && storage.idb === 0, JSON.stringify(storage));
}

// ---- The ordinary component ----
const el = mount();
await el.ready();
el.resetControls();
check("the ordinary component does use storage", storage.local > 0, JSON.stringify(storage));

// Presets and masks.
{
  el.addPickedColor({ r: 10, g: 20, b: 30 }, "exclude");
  el.presets = { old: { ...defaultParams(), scale: 60 } };
  el.updatePresetDropdown();
  el.presetSelect.value = "old";
  el.handleLoadPreset();
  check("an old preset without masks leaves the masks alone",
    el.params.scale === 60 && el.excludedColors.length === 1 && el.excludedColors[0].r === 10);

  el.presetNameInput.value = "with masks";
  el.handleSavePreset();
  el.resetControls();
  check("reset clears the masks", el.excludedColors.length === 0);
  el.presetSelect.value = "with masks";
  el.handleLoadPreset();
  check("a preset saved now brings its masks back",
    el.excludedColors.length === 1 && el.excludedColors[0].b === 30 && Number.isFinite(el.excludedColors[0].y));

  const exported = el.getPreset("Imported one");
  el.resetControls();
  const imported = el.importPreset(JSON.parse(JSON.stringify(exported)));
  check("importing a file keeps it as a preset and applies it",
    imported && el.presets["Imported one"] && el.presets["Imported one"].masks.exclude.length === 1
      && el.excludedColors.length === 1 && el.presetSelect.value === "Imported one");
  const refused = el.importPreset({ ...exported, name: "Nope", version: 2 });
  check("importing a bad file is refused and says why",
    !refused && !el.presets.Nope && /version/.test(el.statusEl.textContent), el.statusEl.textContent);
  const odd = { ...exported, name: "Odd", params: { ...exported.params, scale: 999, sparkle: 1 } };
  el.importPreset(odd);
  check("import warnings are shown", /scale/.test(el.statusEl.textContent) && /sparkle/.test(el.statusEl.textContent), el.statusEl.textContent);
  el.resetControls();
}

// renderBlob beside a picture already in the panel.
{
  const panelPicture = picture(200, 275, 200);
  el.setAttribute("image-data", panelPicture.toDataURL("image/png"));
  await new Promise((resolve) => el.addEventListener("filter-ready", resolve, { once: true }));
  const state = () => ({
    image: el.image, src: el.originalImage.src, w: el.textureWidth, h: el.textureHeight,
    hash: el.currentSettingsHash(), has: el.getAttribute("data-has-image"),
  });
  const unchanged = (a, b) => Object.keys(a).every((k) => a[k] === b[k]);

  const before = state();
  const a = await el.renderBlob(source, { type: "image/png" });
  check("after a success the panel's picture and settings are unchanged", unchanged(before, state()));
  await new Promise((r) => setTimeout(r, 400));
  check("the preview canvas is back at the panel picture's shape",
    Math.abs(el.glCanvas.width / el.glCanvas.height - 200 / 275) < 0.02, el.glCanvas.width + "x" + el.glCanvas.height);

  const garbage = await rejects(el.renderBlob(new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" })));
  check("a picture that can't be decoded rejects", garbage instanceof Error, garbage && garbage.message);
  check("after a failure the panel's picture and settings are unchanged", unchanged(before, state()));
  const wrong = await rejects(el.renderBlob(42));
  check("a source that is neither a Blob nor a URL rejects", wrong instanceof Error);

  const realToBlob = el.glCanvas.toBlob;
  el.glCanvas.toBlob = (callback) => callback(null);
  const empty = await rejects(el.renderBlob(source));
  el.glCanvas.toBlob = realToBlob;
  check("a null blob from the encoder rejects", empty instanceof Error, empty && empty.message);
  check("and the renderer still works afterwards", (await el.renderBlob(source)).blob.size > 0);

  const b = await el.renderBlob(source, { type: "image/png" });
  check("the same render twice gives the same pixels", same((await pixels(a.blob)).data, (await pixels(b.blob)).data));

  const url = URL.createObjectURL(source);
  const fromUrl = await el.renderBlob(url, { type: "image/png" });
  URL.revokeObjectURL(url);
  check("a URL source renders the same as the Blob", same((await pixels(a.blob)).data, (await pixels(fromUrl.blob)).data));

  const sized = await el.renderBlob(source, { type: "image/png", width: 140, height: 192 });
  const sizedPixels = await pixels(sized.blob);
  check("a given size is the size of the decoded picture", sizedPixels.width === 140 && sizedPixels.height === 192);

  const webp = await el.renderBlob(source, { type: "image/webp", quality: 0.92 });
  check("WebP is made when asked for", webp.type === "image/webp" && webp.blob.type === "image/webp", webp.type);
  const fallback = await el.renderBlob(source, { type: "image/nope" });
  check("an unsupported type comes back as PNG, and says so", fallback.type === "image/png", fallback.type);

  // The Download button hands its click event to download(); that is not a name.
  el.download(new MouseEvent("click"));
  check("a download is named after the picture, not after the click", /^Downloaded [a-z0-9-]+.*\.png\.$/i.test(el.statusEl.textContent)
    && !/object/i.test(el.statusEl.textContent), el.statusEl.textContent);
  await new Promise((r) => setTimeout(r, 300));

  // The mask preview never reaches an export.
  el.addPickedColor({ r: 0, g: 0, b: 0 }, "exclude");
  const plain = await pixels((await el.renderBlob(source)).blob);
  el.maskPreviewCheckbox.checked = true;
  el.maskPreviewCheckbox.dispatchEvent(new Event("change"));
  const hashWithPreview = el.currentSettingsHash();
  const tinted = await pixels((await el.renderBlob(source)).blob);
  check("the mask preview is not in an export", el.maskPreview === true && same(plain.data, tinted.data));
  el.renderCanvas();
  const shown = el.displayCtx.getImageData(0, 0, el.canvas.width, el.canvas.height).data;
  el.maskPreviewCheckbox.checked = false;
  el.maskPreviewCheckbox.dispatchEvent(new Event("change"));
  el.renderCanvas();
  const hidden = el.displayCtx.getImageData(0, 0, el.canvas.width, el.canvas.height).data;
  check("the mask preview does tint the on-screen preview", !same(shown, hidden));
  check("the mask preview is not a setting", hashWithPreview === el.currentSettingsHash());
  el.resetControls();

  // Two calls at once must not overlap.
  const log = [];
  const realNow = el.renderBlobNow.bind(el);
  el.renderBlobNow = async (...args) => {
    log.push("start");
    try { return await realNow(...args); } finally { log.push("end"); }
  };
  const [one, two] = await Promise.all([
    el.renderBlob(source, { width: 100, height: 140 }),
    el.renderBlob(source, { width: 60, height: 80 }),
  ]);
  delete el.renderBlobNow;
  check("two calls at once are taken one after the other",
    log.join(",") === "start,end,start,end" && one.width === 100 && two.width === 60
      && (await pixels(one.blob)).width === 100 && (await pixels(two.blob)).width === 60, log.join(","));
  const mixed = await Promise.allSettled([el.renderBlob(42), el.renderBlob(source)]);
  check("a failed call does not block the one queued behind it",
    mixed[0].status === "rejected" && mixed[1].status === "fulfilled");
}

// Settings added later: they start from nothing, and an old preset puts them back to it.
{
  const fresh = mount({ persist: "off" });
  await fresh.ready();
  const render = async () => (await pixels((await fresh.renderBlob(source, { width: 140, height: 192 })).blob)).data;
  const mean = (data) => data.reduce((sum, v, i) => (i % 4 === 3 ? sum : sum + v), 0) / (data.length * 0.75);
  const maxDiff = (a, b) => a.reduce((worst, v, i) => Math.max(worst, Math.abs(v - b[i])), 0);

  const off = await render();
  fresh.setAttribute("lighten", "0.01");
  const first = await render();
  check("Lighten's first step moves the picture only a little", maxDiff(off, first) <= 4 && maxDiff(off, first) > 0, maxDiff(off, first));
  fresh.setAttribute("lighten", "0.5");
  const half = await render();
  check("Lighten 0.5 brightens", mean(half) > mean(off) + 8, mean(off).toFixed(1) + " -> " + mean(half).toFixed(1));
  const hashOn = fresh.currentSettingsHash();
  const exported = fresh.getPreset("on");
  check("an exported look with Lighten on carries it", exported.params.lighten === 0.5);

  const old = fresh.getPreset("old");
  delete old.params.lighten;
  const applied = fresh.applyPreset(old);
  check("an old preset without Lighten turns it off, with nothing to say",
    fresh.params.lighten === 0 && applied.warnings.length === 0, applied.warnings.join(" "));
  check("and the picture is as it was", maxDiff(off, await render()) === 0);
  fresh.applyPreset(exported);
  check("a look with Lighten on comes back with the same hash", fresh.currentSettingsHash() === hashOn);

  fresh.applyPreset(old);
  fresh.setAttribute("relief", "0.6");
  const raised = await render();
  fresh.setAttribute("relief", "-0.6");
  const pressed = await render();
  check("Picture Relief changes the picture, and pressed in is not raised",
    maxDiff(off, raised) > 10 && maxDiff(raised, pressed) > 10, maxDiff(off, raised) + ", " + maxDiff(raised, pressed));
  check("Picture Relief keeps the picture's colours on average (it shades, it doesn't tint)",
    Math.abs(mean(raised) - mean(off)) < 6, mean(off).toFixed(1) + " -> " + mean(raised).toFixed(1));

  fresh.applyPreset(old);
  fresh.setAttribute("glow", "1");
  const glowing = await render();
  let darker = 0;
  for (let i = 0; i < off.length; i++) if (i % 4 !== 3 && glowing[i] < off[i]) darker++;
  check("Glow only ever lightens", mean(glowing) > mean(off) && darker === 0, darker + " values darker");

  fresh.applyPreset(old);
  fresh.setAttribute("vibrance", "1");
  const vivid = await render();
  const chroma = (data) => {
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
    return sum / (data.length / 4);
  };
  check("Vibrance makes the colours richer", chroma(vivid) > chroma(off) + 2, chroma(off).toFixed(1) + " -> " + chroma(vivid).toFixed(1));

  fresh.applyPreset(old);
  fresh.setAttribute("lightpool", "1");
  const pooled = await render();
  const quarter = (data, qx, qy) => {
    let sum = 0, n = 0;
    for (let y = qy * 96; y < (qy + 1) * 96; y++) for (let x = qx * 70; x < (qx + 1) * 70; x++) {
      const i = (y * 140 + x) * 4;
      sum += data[i] + data[i + 1] + data[i + 2]; n += 3;
    }
    return sum / n;
  };
  const gains = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([qx, qy]) => quarter(pooled, qx, qy) - quarter(off, qx, qy));
  check("Light Pool lights one side and dims the other", Math.max(...gains) > 2 && Math.min(...gains) < -0.5, gains.map((g) => g.toFixed(1)).join(", "));

  // Skin Light only ever reaches what Preserve Skin protects.
  fresh.applyPreset(old);
  fresh.setAttribute("skinlight", "1");
  check("Skin Light does nothing with Preserve Skin off", maxDiff(off, await render()) === 0);
  fresh.applyPreset(old);
  fresh.setAttribute("preserveskin", "1");
  const kept = await render();
  fresh.setAttribute("skinlight", "1");
  const skinLit = await render();
  check("with Preserve Skin on, Skin Light lights the protected skin", maxDiff(kept, skinLit) > 4, maxDiff(kept, skinLit));

  const later = ["vibrance", "lightpool", "skinlight"];
  for (const name of later) fresh.setAttribute(name, "0.5");
  const withAll = fresh.getPreset("all");
  for (const name of later) delete withAll.params[name];
  const back = fresh.applyPreset(withAll);
  check("an old preset without Vibrance, Light Pool or Skin Light turns them off, with nothing to say",
    later.every((name) => fresh.params[name] === 0) && back.warnings.length === 0, back.warnings.join(" "));
  fresh.dispose();
}

// Concrete, and choosing styles in the panel.
{
  const panel = mount({ persist: "off" });
  await panel.ready();
  const choose = (index) => {
    const select = panel.inputs.texturetype;
    select.value = String(index);
    select.dispatchEvent(new Event("change"));
  };
  check("each style is its own program, made when first needed",
    Object.keys(panel.programs).join(",") === "0", Object.keys(panel.programs).join(","));
  choose(9);
  const preparing = panel.ready();
  check("while a style's program is made, the panel says so", panel.loadingEl.hidden === false && /Concrete/.test(panel.loadingTextEl.textContent),
    panel.loadingTextEl.textContent);
  await preparing;
  panel.renderCanvas();
  check("and the message goes once it's ready", panel.loadingEl.hidden === true && !!panel.programs[9]);
  check("choosing Concrete brings its defaults, Picture Relief on",
    panel.params.texturetype === 9 && panel.params.relief === 0.5 && panel.params.scale === 85,
    JSON.stringify({ t: panel.params.texturetype, relief: panel.params.relief, scale: panel.params.scale }));
  const concrete = (await pixels((await panel.renderBlob(source, { width: 140, height: 192 })).blob)).data;
  check("Concrete renders a picture", concrete.some((v, i) => i % 4 !== 3 && v > 40) && !same(concrete, sourcePixels.data));
  panel.setAttribute("lighten", "0.4");
  choose(0);
  check("choosing Canvas after it turns Picture Relief off and leaves Lighten alone",
    panel.params.relief === 0 && panel.params.lighten === 0.4, JSON.stringify({ relief: panel.params.relief, lighten: panel.params.lighten }));
  panel.dispose();
}

// Picture Relief reads mipmaps, which go stale if an upload isn't followed by
// new ones: picture A, then B at another size, an export, then the preview
// again must each look exactly like a fresh element given the same thing.
{
  const asDataUrl = (canvas) => canvas.toDataURL("image/png");
  const first = asDataUrl(picture(300, 410, 40));
  const second = asDataUrl(picture(180, 250, 260));
  const loaded = (el) => new Promise((resolve) => el.addEventListener("filter-ready", resolve, { once: true }));
  const preview = (el) => {
    el.renderCanvas();
    const gl = el.gl;
    const out = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return { size: gl.drawingBufferWidth + "x" + gl.drawingBufferHeight, data: out };
  };
  const sameView = (a, b) => a.size === b.size && same(a.data, b.data);
  const withRelief = async (dataUrl) => {
    const el = mount({ persist: "off", relief: "0.7" });
    await el.ready();
    if (dataUrl) {
      const wait = loaded(el);
      el.setAttribute("image-data", dataUrl);
      await wait;
      await new Promise((r) => setTimeout(r, 300));
    }
    return el;
  };

  const freshA = await withRelief(first);
  const viewA = preview(freshA);
  freshA.dispose();
  const freshB = await withRelief(second);
  const viewB = preview(freshB);
  const exportB = (await pixels((await freshB.renderBlob(source)).blob)).data;
  freshB.dispose();

  const el = await withRelief(first);
  check("relief preview of A matches a fresh element", sameView(preview(el), viewA));
  const wait = loaded(el);
  el.setAttribute("image-data", second);
  await wait;
  await new Promise((r) => setTimeout(r, 300));
  check("after replacing A with B, the preview matches a fresh element with B", sameView(preview(el), viewB));
  const exported = (await pixels((await el.renderBlob(source)).blob)).data;
  check("an export from it matches a fresh element's export", same(exported, exportB));
  await new Promise((r) => setTimeout(r, 300));
  check("and the preview after the export is still B's", sameView(preview(el), viewB));
  const middle = viewB.data.length / 2;
  check("the relief preview is not black", viewB.data.slice(middle, middle + 4000).some((v, i) => i % 4 !== 3 && v > 40));
  // An incomplete mip chain reads as flat black: no slope, so no relief at
  // all, in this element and in a fresh one alike. So the relief must show.
  el.setAttribute("relief", "0");
  await new Promise((r) => setTimeout(r, 300));
  check("the relief does show in the preview", !same(preview(el).data, viewB.data));
  el.setAttribute("relief", "0.7");
  // Same size, other picture: stale mips would still hold B's edges.
  const third = asDataUrl(picture(180, 250, 120));
  const freshC = await withRelief(third);
  const viewC = preview(freshC);
  freshC.dispose();
  const waitC = loaded(el);
  el.setAttribute("image-data", third);
  await waitC;
  await new Promise((r) => setTimeout(r, 300));
  check("a picture of the same size replacing B matches a fresh element", sameView(preview(el), viewC));
  el.dispose();
}

// Context loss.
{
  const lost = mount({ persist: "off" });
  await lost.ready();
  let heard = "";
  lost.addEventListener("filter-error", (e) => (heard = e.detail.message));
  lost.gl.getExtension("WEBGL_lose_context").loseContext();
  await new Promise((r) => setTimeout(r, 200));
  const afterLoss = await rejects(lost.renderBlob(source));
  check("a lost context rejects renderBlob", afterLoss instanceof Error && /lost/.test(afterLoss.message), afterLoss && afterLoss.message);
  check("a lost context rejects ready() and is announced", (await rejects(lost.ready())) instanceof Error && /lost/.test(heard));
  lost.dispose();
}

// A shader that fails to link.
{
  const broken = document.createElement("texturize-filter");
  broken.setAttribute("persist", "off");
  const real = broken.createShader.bind(broken);
  broken.createShader = (type) => real(type, "this is not GLSL");
  document.body.appendChild(broken);
  const failure = await rejects(broken.ready());
  check("a shader failure rejects ready()", failure instanceof Error, failure && failure.message);
  const render = await rejects(broken.renderBlob(source));
  check("a shader failure rejects renderBlob, with no picture", render instanceof Error);
  broken.dispose();
}

// An element that was never put in the page.
{
  const loose = document.createElement("texturize-filter");
  check("ready() rejects off the page instead of waiting forever", (await rejects(loose.ready())) instanceof Error);
}

// dispose.
{
  const gl = el.gl;
  const pending = el.renderBlob(source);
  el.dispose();
  check("dispose rejects a render that was under way", (await rejects(pending)) instanceof Error);
  check("dispose frees the context", gl.isContextLost() && el.gl === null && el.program === null);
  check("after dispose, ready() and renderBlob() reject",
    (await rejects(el.ready())) instanceof Error && (await rejects(el.renderBlob(source))) instanceof Error);
  el.remove();
  document.body.appendChild(el);
  await new Promise((r) => setTimeout(r, 300));
  check("a disposed element stays disposed when put back", el.gl === null);
}

await fetch("/log", { method: "POST", body: JSON.stringify({ done: true, results }) });
`;

const page = `<!doctype html><meta charset="utf-8"><title>texturizer check</title>
<script>
const report = (error) => fetch("/log", { method: "POST", body: JSON.stringify({ error: String(error) }) });
addEventListener("error", (e) => report((e.error && e.error.stack) || e.message || e), true);
addEventListener("unhandledrejection", (e) => report((e.reason && e.reason.stack) || e.reason));
</script>
<script type="module">
${pageScript}
</script>`;

function run() {
  return new Promise((resolve, reject) => {
    let chrome;
    let timer;
    const finish = (error, results) => {
      clearTimeout(timer);
      chrome?.kill();
      server.close();
      if (error) reject(error);
      else resolve(results);
    };

    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://x");
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" }).end(page);
      } else if (req.method === "GET" && /^\/src\/[a-z-]+\.js$/.test(url.pathname)) {
        res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store" })
          .end(readFileSync(join(ROOT, url.pathname.slice(1))));
      } else if (req.method === "POST" && url.pathname === "/log") {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          res.writeHead(204).end();
          const message = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (message.error) finish(new Error(message.error));
          else if (message.done) finish(null, message.results);
        });
      } else {
        res.writeHead(404).end();
      }
    });

    server.listen(0, "127.0.0.1", () => {
      chrome = spawn(findChrome(), [
        "--headless=new",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${mkdtempSync(join(tmpdir(), "texturizer-check-"))}`,
        `http://127.0.0.1:${server.address().port}/`,
      ], { stdio: "ignore" });
      chrome.on("error", (e) => finish(e));
      timer = setTimeout(() => finish(new Error("Timed out after 180 s.")), 180_000);
    });
  });
}

const results = await run();
let failed = 0;
for (const { name, ok, detail } of results) {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`);
}
console.log(`\n${results.length - failed} of ${results.length} passed.`);
process.exit(failed ? 1 : 0);
