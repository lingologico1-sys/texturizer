# Texturizer

See `README.md` for what the app does, the feature list, and the deploy setup.
This file covers what you need to work in the code.

## Shape of the thing

Vanilla JS + Vite. **Zero runtime dependencies** — no framework, no state
library. The only devDeps are `vite` and `wrangler`. Keep it that way; JSZip is
the one third-party library and it is fetched on demand inside `loadJSZip()`
rather than bundled.

Everything is one Web Component, `<texturize-filter>`, defined in
**`src/canvas-filter.js` (~3,800 lines)**. `src/main.js` is a 6-line side-effect
import that registers it. There is no backend — all processing is GPU-side in
the browser.

The settings schema is the second source file, **`src/preset.js`**: the list of
controls, their defaults, the checks on a preset file, and `settingsHash`. It
has **no browser dependencies and no imports, and must stay that way**:
translator runs it on its server to check an uploaded preset, where
`canvas-filter.js` (which extends `HTMLElement`) could never load.
`canvas-filter.js` is an ES module that imports it.

The component carries its own Shadow DOM, markup, and styles, because it was
originally a Wix custom element dropped into a page it didn't control. That
constraint is why the UI is built by string template in `renderTemplate()`
instead of by any framework, and why it must survive being moved around the DOM.

## Navigating canvas-filter.js

Rough map, since it is one long class:

| Lines | What |
|---|---|
| 1–55 | Imports from `preset.js`, module constants (`PREVIEW_SUPERSAMPLE`, build SHA, storage keys), `soon()` |
| 55–325 | Lifecycle — `constructor`, `connectedCallback`, `scheduleGraphicsBoot`, `bootGraphics`, `disconnectedCallback`, `attributeChangedCallback` |
| 326–1213 | `renderTemplate()` — the entire UI as a template string |
| 1214–1353 | `cacheElements()`, `bindUiEvents()` |
| 1354–1720 | Presets (with masks), `getPreset` / `applyPreset`, Export / Import, batch/zip |
| 1722–1870 | Colour masks, version badge, fullscreen |
| 1874–2030 | Colour picking (include/exclude chips), `processImageForBatch` |
| 2031–2725 | `initWebGL()` — **the GLSL lives here** |
| 2731–2870 | Shader compile/link, `failRenderer`, `ready()`, `dispose()` |
| 2995–3160 | Image loading, object URLs |
| 3160–3385 | Preview budget, canvas sizing, control sync, settings and IndexedDB persistence |
| 3389–3510 | `requestRender`, `renderCanvas`, `drawFrame` |
| 3512–3640 | `renderBlob` (the host's export), `decodeSource` |
| 3640–3818 | `renderFullRes`, `updateDisplay`, download, filename, status, `emit` |

The fragment shader inlines all ten texture styles across nine height taps.
It is long and branchy on purpose — one program, no per-style recompile.
Picture Relief reads the same image on texture unit 1 through a mipmapped
sampler object; every level-0 upload into an image texture must be followed
by `generateMipmap` (see `initWebGL`).

**New settings are `addedLater` in `preset.js`, with identity 0.** At 0 they
are left out of the hash and of exported files, so old looks keep their hash
and pixels; `npm run check:pixels` proves the pixels against 04d142d. Styles
from Concrete (9) on sample a share of the picture, not output pixels
(`sampleScale()`); don't change the older styles' sampling.

## Things that will bite you

**Shader compilation is asynchronous.** `awaitProgram()` polls
`COMPLETION_STATUS_KHR` via `KHR_parallel_shader_compile`. Anything needing a
usable program must go through that path — touching the program while it is
still linking is a real failure mode that has been fixed once already
(see commit `0ab3aa8`).

**The component must survive being moved in the DOM.** `disconnectedCallback`
can fire and then reconnect. Don't assume `connectedCallback` runs once
(commit `e02033c`).

**Preview renders at `PREVIEW_SUPERSAMPLE` (2×) the display size**, not full
image resolution. `renderFullRes()` / `restorePreviewRes()` switch modes for
download. If output looks right on screen but wrong in the PNG, that boundary is
where to look.

**Images persist to IndexedDB as blobs, settings to localStorage.** The split
exists because IndexedDB cannot store an object URL's bytes — see the comment at
`loadImageFromDataUrl()`. Keep blob and data-URL paths distinct.

**`__APP_VERSION__` and `__BUILD_TIME__`** are injected by `vite.config.js` via
`define` (git short SHA, falling back to `GITHUB_SHA` then `"dev"`). They are
compile-time literals, not variables — the guarded `typeof` checks at the top of
`canvas-filter.js` are what keep the file loadable outside a Vite build.

## The component inside translator

translator (the owner's deck-making app) keeps a pinned copy of **both** source
files and makes each lingomondo card's reveal face with it. Its manifest records
this repo's commit and each file's sha256, and its checks compare the copy with
this repo at that commit. So:

- A change here does nothing to translator until its copy is refreshed. A
  change to the shader or to `preset.js` then gives a new renderer identity
  there; pictures already made are kept.
- The host uses only this surface. Keep it working, and keep
  `npm run check:browser` passing:
  - `await el.ready()` — resolves once the shader has linked; rejects on a
    compile or link failure, a lost context, or after `dispose()`.
  - `el.getPreset(name)` / `el.applyPreset(obj)` — a v1 preset object (params
    and masks). `applyPreset` returns `{ settingsHash, warnings }` and throws,
    changing nothing, if the preset is refused. `el.currentSettingsHash()`.
  - `await el.renderBlob(source, { type, quality, width, height })` — renders a
    Blob or URL with the current settings, leaving the panel's own picture
    alone. Resolves to `{ blob, type, width, height }` (`type` is what the
    encoder really made). Rejects rather than hand back a blank picture. Calls
    are taken one at a time.
  - `el.dispose()` — frees the GPU. Removing the element does not.
  - `persist="off"` — embedded mode: no `localStorage` or IndexedDB at all, and
    the title, file picker, presets box, batch and download buttons are
    hidden (the host has its own). Reset stays.
  - the `settings-change` event, and `image-data` for the panel's picture.
- **A preset's masks are stored as r, g, b only.** Y/Cb/Cr are always worked
  out from them (`rgbToYCbCr` in `preset.js`), never read from a file.
- **The mask preview is a view aid, not a setting.** It is never saved, is not
  in the hash, and `drawFrame` is told to leave it out of every export.

## Commands

```bash
npm run dev        # vite, http://localhost:5173
npm run build
npm run preview
npm run pages:dev  # wrangler pages dev proxying 5173
npm test           # src/preset.js in plain Node (no browser)
npm run check:browser  # the component in headless Chrome, software WebGL
npm run check:pixels   # old looks render identically to 04d142d (BASE=<commit> to change)
```

Both checks are dependency-free scripts (`node --test`, and a spawned Chrome;
set `CHROME` to its path if it isn't found). There is no linter configured.

**Do not run `npm run deploy`.** Pushing to `main` triggers
`.github/workflows/deploy.yml`, which builds and deploys to Cloudflare Pages.
Deploying by hand from a dirty tree is how the badge stops matching what is live.

## Conventions

Commit subjects read as sentences describing the effect, not conventional-commit
prefixes — "Survive being moved in the DOM, and an image that beats the boot
frame", "Match black picks on luma so writing stays out of the weave". Match
that. Comments explain the constraint behind a decision, not the mechanics.
