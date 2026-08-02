# Texturizer

See `README.md` for what the app does, the feature list, and the deploy setup.
This file covers what you need to work in the code.

## Shape of the thing

Vanilla JS + Vite. **Zero runtime dependencies** — no framework, no state
library. The only devDeps are `vite` and `wrangler`. Keep it that way; JSZip is
the one third-party library and it is fetched on demand inside `loadJSZip()`
rather than bundled.

Everything is one Web Component, `<texturize-filter>`, defined in
**`src/canvas-filter.js` (~3,400 lines)**. `src/main.js` is a 6-line side-effect
import that registers it. There is no backend — all processing is GPU-side in
the browser.

The component carries its own Shadow DOM, markup, and styles, because it was
originally a Wix custom element dropped into a page it didn't control. That
constraint is why the UI is built by string template in `renderTemplate()`
instead of by any framework, and why it must survive being moved around the DOM.

## Navigating canvas-filter.js

Rough map, since it is one long class:

| Lines | What |
|---|---|
| 1–26 | Module constants (`PREVIEW_SUPERSAMPLE`, build SHA, storage keys) |
| 63–320 | Lifecycle — `constructor`, `connectedCallback`, `scheduleGraphicsBoot`, `disconnectedCallback`, `attributeChangedCallback` |
| 318–1190 | `renderTemplate()` — the entire UI as a template string |
| 1189–1330 | `cacheElements()`, `bindUiEvents()` |
| 1321–1600 | Presets, batch/zip, color masks |
| 1686–1830 | Colour picking (include/exclude chips) |
| 1841–2530 | `initWebGL()` — **the GLSL lives here**, vertex at 1864, fragment at 1878 |
| 2533–2700 | Shader compile/link, resize observer |
| 2696–2860 | Image loading, object URLs, IndexedDB persistence |
| 2861–3060 | Preview budget, canvas sizing, control sync, settings persistence |
| 3075–3260 | `requestRender`, `renderCanvas`, `renderFullRes`, `updateDisplay` |
| 3288–3380 | Download, filename, status, `emit` |

The fragment shader inlines all nine texture styles across nine height taps.
It is long and branchy on purpose — one program, no per-style recompile.

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

## Commands

```bash
npm run dev        # vite, http://localhost:5173
npm run build
npm run preview
npm run pages:dev  # wrangler pages dev proxying 5173
```

There is no test suite and no linter configured.

**Do not run `npm run deploy`.** Pushing to `main` triggers
`.github/workflows/deploy.yml`, which builds and deploys to Cloudflare Pages.
Deploying by hand from a dirty tree is how the badge stops matching what is live.

## Conventions

Commit subjects read as sentences describing the effect, not conventional-commit
prefixes — "Survive being moved in the DOM, and an image that beats the boot
frame", "Match black picks on luma so writing stays out of the weave". Match
that. Comments explain the constraint behind a decision, not the mechanics.
