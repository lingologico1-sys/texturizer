// The settings schema: what a texture is made of, how a preset file is
// checked, and the hash that names a set of settings.
//
// This file has no browser dependencies on purpose. canvas-filter.js extends
// HTMLElement and cannot load on a server; this can, so a host app (translator)
// runs the very same checks on its server as the component runs in the page.
// Keep it that way: no DOM, no storage, no imports.

export const PRESET_FORMAT = "texturizer-preset";
export const PRESET_VERSION = 1;
export const MAX_MASK_COLORS = 32;

// One entry per setting. `type` decides the control the panel draws and how a
// value is checked; `value` is the default.
//
// `addedLater` marks a setting that came after looks were already being saved
// and hashed (translator keeps reveal faces by the hash). Its `value` is the
// setting's identity, the value that changes nothing, and must stay 0 for
// good: at that value the setting is left out of the hash and out of an
// exported file, and a file without it takes it quietly. So a look that
// doesn't use it keeps the hash, the file and the pixels it always had.
export const CONTROL_CONFIG = {
  texturetype: { type: "select", group: "Texture", label: "Texture Style", options: ["Canvas", "Paper", "Ink Wash", "Clay", "Linocut", "Leather", "Slate", "Mosaic", "Canvas 2", "Concrete"], value: 0, min: 0, max: 9, step: 1, suffix: "" },
  scale: { type: "range", group: "Texture", label: "Scale", min: 4, max: 120, step: 1, value: 36, suffix: "" },
  angle: { type: "range", group: "Texture", label: "Angle", min: -180, max: 180, step: 1, value: 0, suffix: "°" },
  warp: { type: "range", group: "Texture", label: "Warp", min: 0, max: 1, step: 0.01, value: 0, suffix: "" },

  depth: { type: "range", group: "Lighting", label: "Depth", min: 0, max: 2, step: 0.01, value: 0.65, suffix: "" },
  soften: { type: "range", group: "Lighting", label: "Soften", min: 0, max: 1, step: 0.01, value: 0.25, suffix: "" },
  intensity: { type: "range", group: "Lighting", label: "Intensity", min: 0, max: 1.5, step: 0.01, value: 1, suffix: "" },
  shininess: { type: "range", group: "Lighting", label: "Shininess", min: 0, max: 1, step: 0.01, value: 0, suffix: "" },
  ao: { type: "range", group: "Lighting", label: "Ambient Occlusion", min: 0, max: 1, step: 0.01, value: 0.5, suffix: "" },
  lightazimuth: { type: "range", group: "Lighting", label: "Light Direction", min: -180, max: 180, step: 1, value: 127, suffix: "°" },
  lightelevation: { type: "range", group: "Lighting", label: "Light Elevation", min: 5, max: 85, step: 1, value: 46, suffix: "°" },
  lighttint: { type: "range", group: "Lighting", label: "Light Warmth", min: -1, max: 1, step: 0.01, value: 0, suffix: "" },
  relief: { type: "range", group: "Lighting", label: "Picture Relief", min: -1, max: 1, step: 0.01, value: 0, suffix: "", addedLater: true },
  lightpool: { type: "range", group: "Lighting", label: "Light Pool", min: 0, max: 1, step: 0.01, value: 0, suffix: "", addedLater: true },

  lighten: { type: "range", group: "Color", label: "Lighten", min: 0, max: 1, step: 0.01, value: 0, suffix: "", addedLater: true },
  brightness: { type: "range", group: "Color", label: "Brightness", min: 0.2, max: 3, step: 0.01, value: 1, suffix: "" },
  contrast: { type: "range", group: "Color", label: "Contrast", min: 0.5, max: 2, step: 0.01, value: 1.08, suffix: "" },
  saturation: { type: "range", group: "Color", label: "Saturation", min: 0, max: 3, step: 0.01, value: 1.0, suffix: "" },
  vibrance: { type: "range", group: "Color", label: "Vibrance", min: 0, max: 1, step: 0.01, value: 0, suffix: "", addedLater: true },
  papertint: { type: "range", group: "Color", label: "Paper Tint", min: 0, max: 1, step: 0.01, value: 0, suffix: "" },
  colorscale: { type: "range", group: "Color", label: "Color → Scale", min: -1, max: 1, step: 0.01, value: 0, suffix: "" },
  colordepth: { type: "range", group: "Color", label: "Color → Depth", min: -1, max: 1, step: 0.01, value: 0, suffix: "" },

  vignette: { type: "range", group: "Effects", label: "Edge Vignette", min: 0, max: 1, step: 0.01, value: 0, suffix: "" },
  dyebleed: { type: "checkbox", group: "Effects", label: "Dye Bleed", min: 0, max: 1, step: 1, value: 0, suffix: "" },
  distressed: { type: "checkbox", group: "Effects", label: "Distressed", min: 0, max: 1, step: 1, value: 0, suffix: "" },
  preserveskin: { type: "checkbox", group: "Effects", label: "Preserve Skin", min: 0, max: 1, step: 1, value: 0, suffix: "" },
  skinlight: { type: "range", group: "Effects", label: "Skin Light", min: 0, max: 1, step: 0.01, value: 0, suffix: "", addedLater: true },
  washcolor: { type: "color", group: "Effects", label: "Wash Color", value: "#6a11cb" },
  washintensity: { type: "range", group: "Effects", label: "Wash Intensity", min: 0, max: 1, step: 0.01, value: 0, suffix: "" },
  sharpness: { type: "range", group: "Effects", label: "Sharpness", min: 0, max: 2, step: 0.01, value: 0, suffix: "" },
  halftone: { type: "range", group: "Effects", label: "Halftone", min: 0, max: 1, step: 0.01, value: 0, suffix: "" },
  glow: { type: "range", group: "Effects", label: "Glow", min: 0, max: 1, step: 0.01, value: 0, suffix: "", addedLater: true },

  masktolerance: { type: "range", group: "Color Masks", label: "Match Tolerance", min: 1, max: 64, step: 1, value: 8, suffix: "" },
  inktolerance: { type: "range", group: "Color Masks", label: "Black / Ink Tolerance", min: 0, max: 160, step: 1, value: 80, suffix: "" }
};

// A setting added after looks were already hashed, sitting at the value
// that changes nothing (see `addedLater` above).
export function atIdentity(name, value) {
  const config = CONTROL_CONFIG[name];
  return !!(config && config.addedLater && value === config.value);
}

export function defaultParams() {
  const params = {};
  for (const [name, config] of Object.entries(CONTROL_CONFIG)) {
    params[name] = config.value;
  }
  return params;
}

// The shader matches mask colours on luma and chroma. RGB is what a preset
// stores; these are always worked out from it, never read from a file.
export function rgbToYCbCr(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return { y, cb, cr };
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Sliders hand back values like 0.30000000000000004. Six places keeps every
// step the panel can produce and drops the float noise, so the same look
// always gets the same hash.
function tidyNumber(value) {
  const rounded = Math.round(value * 1e6) / 1e6;
  return rounded === 0 ? 0 : rounded;
}

function checkParam(name, config, raw, warnings, errors) {
  if (config.type === "color") {
    if (typeof raw === "string" && /^#[0-9a-f]{6}$/i.test(raw)) {
      return raw.toLowerCase();
    }
    errors.push(`"${name}" must be a colour written as #rrggbb, not ${JSON.stringify(raw)}.`);
    return config.value;
  }

  if (config.type === "checkbox") {
    if (raw === true || raw === 1) return 1;
    if (raw === false || raw === 0) return 0;
    errors.push(`"${name}" must be 0 or 1 (or true or false), not ${JSON.stringify(raw)}.`);
    return config.value;
  }

  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    errors.push(`"${name}" must be a number, not ${JSON.stringify(raw)}.`);
    return config.value;
  }

  if (config.type === "select") {
    if (!Number.isInteger(raw) || raw < config.min || raw > config.max) {
      errors.push(`"${name}" must be a whole number from ${config.min} to ${config.max}, not ${raw}.`);
      return config.value;
    }
    return raw;
  }

  const clamped = Math.min(config.max, Math.max(config.min, raw));
  if (clamped !== raw) {
    warnings.push(`"${name}" was ${raw}, outside ${config.min} to ${config.max}; ${clamped} is used.`);
  }
  return tidyNumber(clamped);
}

function checkMaskList(label, raw, warnings, errors) {
  if (raw === undefined) {
    warnings.push(`The "${label}" mask list was missing; an empty one is used.`);
    return [];
  }

  if (!Array.isArray(raw)) {
    errors.push(`The "${label}" mask list must be a list of colours.`);
    return [];
  }

  if (raw.length > MAX_MASK_COLORS) {
    errors.push(`The "${label}" mask list has ${raw.length} colours; the most allowed is ${MAX_MASK_COLORS}.`);
    return [];
  }

  const channel = (v) => Number.isInteger(v) && v >= 0 && v <= 255;
  const list = [];
  raw.forEach((color, i) => {
    if (isObject(color) && channel(color.r) && channel(color.g) && channel(color.b)) {
      list.push({ r: color.r, g: color.g, b: color.b });
    } else {
      errors.push(`Colour ${i + 1} of the "${label}" mask list must have r, g and b as whole numbers from 0 to 255.`);
    }
  });
  return list;
}

// Check and tidy a { params, masks } pair. The result is complete: every
// setting present, every value in range, masks as plain r/g/b.
// Returns { settings, warnings, errors }; `settings` is null when anything
// was refused. Warnings are for the person to read, so callers must show them.
export function normalizeSettings(input) {
  const warnings = [];
  const errors = [];

  if (!isObject(input)) {
    return { settings: null, warnings, errors: ["The settings must be an object with params and masks."] };
  }

  const params = {};
  if (!isObject(input.params)) {
    errors.push('"params" is missing or is not an object.');
  } else {
    for (const [name, config] of Object.entries(CONTROL_CONFIG)) {
      const raw = input.params[name];
      if (raw === undefined) {
        if (!config.addedLater) {
          warnings.push(`"${name}" was missing; its default (${config.value}) is used.`);
        }
        params[name] = config.value;
      } else {
        params[name] = checkParam(name, config, raw, warnings, errors);
      }
    }

    for (const name of Object.keys(input.params)) {
      if (!Object.prototype.hasOwnProperty.call(CONTROL_CONFIG, name)) {
        warnings.push(`"${name}" is not a setting this build knows; it was dropped.`);
      }
    }
  }

  const masks = { exclude: [], include: [], excludeAll: false };
  if (input.masks === undefined) {
    warnings.push("The colour masks were missing; none are used.");
  } else if (!isObject(input.masks)) {
    errors.push('"masks" must be an object with exclude, include and excludeAll.');
  } else {
    masks.exclude = checkMaskList("exclude", input.masks.exclude, warnings, errors);
    masks.include = checkMaskList("include", input.masks.include, warnings, errors);
    if (input.masks.excludeAll === undefined) {
      warnings.push('"excludeAll" was missing; it is taken as off.');
    } else if (typeof input.masks.excludeAll !== "boolean") {
      errors.push('"excludeAll" must be true or false.');
    } else {
      masks.excludeAll = input.masks.excludeAll;
    }
  }

  return { settings: errors.length ? null : { params, masks }, warnings, errors };
}

// The identity of a look: a sha256 over the normalised params and masks only.
// A preset's name, dates and build are left out, so exporting the same
// settings twice gives the same hash, and so are settings added later while
// at their identity, so old looks keep their hashes. Throws if the settings
// are refused.
export function settingsHash(input) {
  const { settings, errors } = normalizeSettings(input);
  if (!settings) {
    throw new Error(errors.join(" "));
  }

  const rgb = (list) => list.map((c) => [c.r, c.g, c.b]);
  const canonical = JSON.stringify({
    params: Object.keys(settings.params).sort()
      .filter((name) => !atIdentity(name, settings.params[name]))
      .map((name) => [name, settings.params[name]]),
    masks: {
      exclude: rgb(settings.masks.exclude),
      include: rgb(settings.masks.include),
      excludeAll: settings.masks.excludeAll
    }
  });

  return sha256Hex(canonical);
}

// Build a v1 preset file object from settings that are already known good.
export function makePreset({ name, exported, build, settings }) {
  return {
    format: PRESET_FORMAT,
    version: PRESET_VERSION,
    name: String(name || "").trim() || "Untitled",
    exported: exported || new Date().toISOString(),
    build: String(build || ""),
    // Left out at their identity, so an older build reads the file with
    // nothing to say about settings it doesn't know.
    params: Object.fromEntries(Object.entries(settings.params).filter(([name, value]) => !atIdentity(name, value))),
    masks: {
      exclude: settings.masks.exclude.map((c) => ({ r: c.r, g: c.g, b: c.b })),
      include: settings.masks.include.map((c) => ({ r: c.r, g: c.g, b: c.b })),
      excludeAll: settings.masks.excludeAll
    }
  };
}

// Check a whole preset file (format v1).
// Returns { ok, preset, settingsHash, warnings, errors }. When ok, `preset` is
// the normalised file object and `settingsHash` names its look.
export function validatePreset(input) {
  if (!isObject(input)) {
    return { ok: false, preset: null, settingsHash: null, warnings: [], errors: ["This is not a preset file."] };
  }

  if (input.format !== PRESET_FORMAT) {
    return { ok: false, preset: null, settingsHash: null, warnings: [], errors: [`This is not a Texturizer preset file (its format is ${JSON.stringify(input.format)}).`] };
  }

  if (input.version !== PRESET_VERSION) {
    return { ok: false, preset: null, settingsHash: null, warnings: [], errors: [`This preset is version ${JSON.stringify(input.version)}; this build reads version ${PRESET_VERSION}.`] };
  }

  const { settings, warnings, errors } = normalizeSettings({ params: input.params, masks: input.masks });

  let name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    warnings.push('The preset had no name; "Untitled" is used.');
    name = "Untitled";
  }

  let exported = "";
  if (typeof input.exported === "string" && !Number.isNaN(Date.parse(input.exported))) {
    exported = input.exported;
  } else {
    warnings.push("The preset had no export date.");
  }

  const build = typeof input.build === "string" ? input.build : "";

  if (!settings) {
    return { ok: false, preset: null, settingsHash: null, warnings, errors };
  }

  // An undated file stays undated; makePreset would stamp it with today.
  const preset = { ...makePreset({ name, build, settings }), exported };

  return { ok: true, preset, settingsHash: settingsHash(settings), warnings, errors };
}

// A small sha256, because the hash has to be the same call everywhere this
// file runs and crypto.subtle is async and missing on plain-http pages.
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

export function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }

  return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
}
