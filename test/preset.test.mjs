// Checks the settings schema in plain Node, with no browser: the same file a
// host app's server runs.
//
//   npm test

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  CONTROL_CONFIG,
  defaultParams,
  atIdentity,
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

// Real preset files, exported from the live Texturizer at 04d142d before
// any setting was added. 02, 03 and 04 are installed in translator, whose
// server stored them under these same hashes; 04 is its house look. A
// change to the schema must leave every one of them hashing as it did, or
// translator would take an old look for a new one.
const FIXTURE_HASHES = {
  "01": "cef7bcf6636f436983a39d319c14d4a461d190958164da2caeac9b9fa07bcb50",
  "02": "a1e1b168c7013995dbf0b2c93ef4384d197bb101a7c1cefba6838e166218a269",
  "03": "e911252d418f0694142286cddb3c022c27645b49ada6c076baef5e9fa8d86ca7",
  "04": "33c64c7661e64d53131ad598f6bf1d0feb220c96ba1fb2c5f6e252a490dd3c91"
};
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/presets/${name}.json`, import.meta.url), "utf8"));

test("real old preset files keep their hashes, with nothing to say", () => {
  for (const [name, hash] of Object.entries(FIXTURE_HASHES)) {
    const r = validatePreset(fixture(name));
    assert.ok(r.ok, name);
    assert.deepEqual(r.warnings, [], name);
    assert.equal(r.settingsHash, hash, name);
  }
});

test("the defaults keep their hash", () => {
  assert.equal(settingsHash(good()), "11ffd3a8c6b9c27a8ae57aa11c4c2147cf63c6c90f995d636272681cdfb06443");
});

test("an old file exported again keeps its hash", () => {
  for (const [name, hash] of Object.entries(FIXTURE_HASHES)) {
    const { preset } = validatePreset(fixture(name));
    const again = validatePreset(JSON.parse(JSON.stringify(makePreset({ name, build: "dev", settings: preset }))));
    assert.ok(again.ok, name);
    assert.deepEqual(again.warnings, [], name);
    assert.equal(again.settingsHash, hash, name);
  }
});

const ADDED_LATER = Object.keys(CONTROL_CONFIG).filter((name) => CONTROL_CONFIG[name].addedLater);

test("every setting added later has identity 0", () => {
  assert.ok(ADDED_LATER.length > 0);
  for (const name of ADDED_LATER) {
    assert.equal(CONTROL_CONFIG[name].value, 0, name);
    assert.ok(atIdentity(name, 0), name);
    assert.ok(!atIdentity(name, 0.5), name);
  }
  assert.ok(!atIdentity("scale", CONTROL_CONFIG.scale.value));
});

test("a setting added later: missing, explicit 0 and non-zero", () => {
  for (const name of ADDED_LATER) {
    const missing = good();
    delete missing.params[name];
    const r = normalizeSettings(missing);
    assert.deepEqual(r.warnings, [], name);
    assert.equal(r.settings.params[name], 0, name);

    const zero = good();
    zero.params[name] = 0;
    assert.equal(settingsHash(zero), settingsHash(missing), name);

    const on = good();
    on.params[name] = CONTROL_CONFIG[name].max;
    assert.notEqual(settingsHash(on), settingsHash(missing), name);
  }
});

test("an exported file leaves settings added later out at 0, and keeps them otherwise", () => {
  const off = makePreset({ name: "x", build: "dev", settings: normalizeSettings(good()).settings });
  for (const name of ADDED_LATER) assert.ok(!(name in off.params), name);

  const s = good();
  for (const name of ADDED_LATER) s.params[name] = CONTROL_CONFIG[name].max;
  const on = makePreset({ name: "x", build: "dev", settings: normalizeSettings(s).settings });
  for (const name of ADDED_LATER) assert.equal(on.params[name], CONTROL_CONFIG[name].max, name);

  const back = validatePreset(JSON.parse(JSON.stringify(on)));
  assert.ok(back.ok);
  assert.deepEqual(back.warnings, []);
  assert.equal(back.settingsHash, settingsHash(s));
});

test("an old file with a new setting turned on gets a new hash, and keeps it through a round trip", () => {
  const old = fixture("04");
  const changed = { ...old, params: { ...old.params, [ADDED_LATER[0]]: 0.5 } };
  const r = validatePreset(changed);
  assert.ok(r.ok);
  assert.notEqual(r.settingsHash, FIXTURE_HASHES["04"]);
  const again = validatePreset(JSON.parse(JSON.stringify(r.preset)));
  assert.equal(again.settingsHash, r.settingsHash);
});
