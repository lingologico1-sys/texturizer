// Checks the settings schema in plain Node, with no browser: the same file a
// host app's server runs.
//
//   npm test

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  CONTROL_CONFIG,
  defaultParams,
  makePreset,
  normalizeSettings,
  settingsHash,
  sha256Hex,
  validatePreset
} from "../src/preset.js";

const noMasks = () => ({ exclude: [], include: [], excludeAll: false });
const good = () => ({ params: defaultParams(), masks: noMasks() });
const file = (over = {}) => ({
  format: "texturizer-preset",
  version: 1,
  name: "House",
  exported: "2026-10-12T15:04:00Z",
  build: "abc1234",
  ...good(),
  ...over
});

test("sha256 matches Node's", () => {
  for (const text of ["", "abc", "é→布", "x".repeat(55), "x".repeat(56), "x".repeat(64), "x".repeat(1000)]) {
    assert.equal(sha256Hex(text), createHash("sha256").update(text).digest("hex"));
  }
});

test("defaults pass with nothing to say", () => {
  const { settings, warnings, errors } = normalizeSettings(good());
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(Object.keys(settings.params), Object.keys(CONTROL_CONFIG));
});

test("the hash ignores name, dates and build", () => {
  const a = validatePreset(file());
  const b = validatePreset(file({ name: "Other", exported: "2027-01-01T00:00:00Z", build: "zzz" }));
  assert.ok(a.ok && b.ok);
  assert.equal(a.settingsHash, b.settingsHash);
  assert.match(a.settingsHash, /^[0-9a-f]{64}$/);
});

test("the hash changes with a param or a mask", () => {
  const base = settingsHash(good());
  const p = good();
  p.params.scale = 37;
  assert.notEqual(settingsHash(p), base);
  const m = good();
  m.masks.exclude.push({ r: 0, g: 0, b: 0 });
  assert.notEqual(settingsHash(m), base);
  const e = good();
  e.masks.excludeAll = true;
  assert.notEqual(settingsHash(e), base);
});

test("float noise does not change the hash", () => {
  const a = good();
  a.params.depth = 0.3;
  const b = good();
  b.params.depth = 0.1 + 0.2;
  assert.equal(settingsHash(a), settingsHash(b));
});

test("stored y/cb/cr are ignored: rgb is the authority", () => {
  const a = good();
  a.masks.exclude.push({ r: 10, g: 20, b: 30 });
  const b = good();
  b.masks.exclude.push({ r: 10, g: 20, b: 30, y: 999, cb: 1, cr: 2 });
  assert.equal(settingsHash(a), settingsHash(b));
  assert.deepEqual(normalizeSettings(b).settings.masks.exclude, [{ r: 10, g: 20, b: 30 }]);
});

test("an out-of-range value is clamped, with a warning", () => {
  const s = good();
  s.params.scale = 500;
  const { settings, warnings, errors } = normalizeSettings(s);
  assert.deepEqual(errors, []);
  assert.equal(settings.params.scale, 120);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /scale/);
});

test("an unknown key is dropped, with a warning", () => {
  const s = good();
  s.params.sparkle = 3;
  const { settings, warnings } = normalizeSettings(s);
  assert.ok(!("sparkle" in settings.params));
  assert.match(warnings[0], /sparkle/);
});

test("a missing param takes its default, with a warning", () => {
  const s = good();
  delete s.params.depth;
  const { settings, warnings } = normalizeSettings(s);
  assert.equal(settings.params.depth, CONTROL_CONFIG.depth.value);
  assert.match(warnings[0], /depth/);
});

test("a checkbox given as true or false becomes 1 or 0", () => {
  const s = good();
  s.params.dyebleed = true;
  s.params.distressed = false;
  const { settings, warnings, errors } = normalizeSettings(s);
  assert.deepEqual([errors, warnings], [[], []]);
  assert.equal(settings.params.dyebleed, 1);
  assert.equal(settings.params.distressed, 0);
});

const refused = (change, pattern) => {
  const s = good();
  change(s);
  const { settings, errors } = normalizeSettings(s);
  assert.equal(settings, null);
  assert.match(errors.join(" "), pattern);
  assert.throws(() => settingsHash(s));
};

test("a bad mask colour is refused", () => {
  refused((s) => s.masks.exclude.push({ r: 256, g: 0, b: 0 }), /exclude/);
  refused((s) => s.masks.include.push({ r: 1.5, g: 0, b: 0 }), /include/);
  refused((s) => s.masks.include.push("#000000"), /include/);
});

test("33 mask colours are refused", () => {
  refused((s) => {
    s.masks.exclude = Array.from({ length: 33 }, (_, i) => ({ r: i, g: i, b: i }));
  }, /33/);
});

test("32 mask colours are fine", () => {
  const s = good();
  s.masks.exclude = Array.from({ length: 32 }, (_, i) => ({ r: i, g: i, b: i }));
  assert.ok(normalizeSettings(s).settings);
});

test("a washcolor that isn't #rrggbb is refused; a good one is lower-cased", () => {
  refused((s) => (s.params.washcolor = "purple"), /washcolor/);
  refused((s) => (s.params.washcolor = "#abc"), /washcolor/);
  const s = good();
  s.params.washcolor = "#6A11CB";
  assert.equal(normalizeSettings(s).settings.params.washcolor, "#6a11cb");
});

test("a texturetype of 9 is refused", () => {
  refused((s) => (s.params.texturetype = 9), /texturetype/);
  refused((s) => (s.params.texturetype = 1.5), /texturetype/);
});

test("other wrong types are refused", () => {
  refused((s) => (s.params.scale = "36"), /scale/);
  refused((s) => (s.params.scale = NaN), /scale/);
  refused((s) => (s.params.dyebleed = 2), /dyebleed/);
  refused((s) => (s.masks.excludeAll = "yes"), /excludeAll/);
  refused((s) => (s.masks = []), /masks/);
});

test("a preset file is checked for format and version", () => {
  assert.equal(validatePreset(null).ok, false);
  assert.equal(validatePreset(file({ format: "other" })).ok, false);
  assert.equal(validatePreset(file({ version: 2 })).ok, false);
  const bad = validatePreset(file({ params: { ...defaultParams(), texturetype: 9 } }));
  assert.equal(bad.ok, false);
  assert.equal(bad.preset, null);
});

test("a file without masks loads with a warning and no masks", () => {
  const f = file();
  delete f.masks;
  const r = validatePreset(f);
  assert.ok(r.ok);
  assert.deepEqual(r.preset.masks, noMasks());
  assert.match(r.warnings.join(" "), /masks/);
});

test("a round trip through makePreset and JSON keeps the hash", () => {
  const s = good();
  s.params.texturetype = 3;
  s.params.washcolor = "#112233";
  s.masks.include.push({ r: 200, g: 100, b: 50 });
  const { settings } = normalizeSettings(s);
  const out = makePreset({ name: "Round trip", build: "dev", settings });
  const back = validatePreset(JSON.parse(JSON.stringify(out)));
  assert.ok(back.ok);
  assert.deepEqual(back.warnings, []);
  assert.equal(back.settingsHash, settingsHash(settings));
  assert.equal(back.preset.name, "Round trip");
});
