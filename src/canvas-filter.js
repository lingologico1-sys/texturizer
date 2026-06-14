(function () {
  "use strict";

  const TAG_NAME = "texturize-filter";

  if (customElements.get(TAG_NAME)) {
    return;
  }

  class CanvasFilterElement extends HTMLElement {
    static get observedAttributes() {
      return [
        "texturetype",
        "scale",
        "depth",
        "angle",
        "intensity",
        "soften",
        "contrast",
        "brightness",
        "warp",
        "colorscale",
        "colordepth",
        "shininess",
        "lightazimuth",
        "lightelevation",
        "lighttint",
        "ao",
        "papertint",
        "vignette",
        "dyebleed",
        "distressed",
        "preserveskin",
        "washcolor",
        "washintensity",
        "sharpness",
        "saturation",
        "halftone",
        "image-data",
        "export-request"
      ];
    }

    constructor() {
      super();

      this.attachShadow({ mode: "open" });

      this.gl = null;
      this.program = null;
      this.vao = null;
      this.texture = null;
      this.image = null;
      this.textureSource = null;
      this.textureWidth = 1;
      this.textureHeight = 1;
      this.maxTextureSize = 4096;
      this.resizeObserver = null;
      this.animationFrame = 0;
      this.imageLoadToken = 0;
      this.isReady = false;

      this.params = {
        texturetype: 0,
        scale: 36,
        depth: 0.65,
        angle: 0,
        intensity: 1,
        soften: 0.25,
        contrast: 1.08,
        brightness: 1,
        warp: 0,
        colorscale: 0,
        colordepth: 0,
        shininess: 0,
        lightazimuth: 127,
        lightelevation: 46,
        lighttint: 0,
        ao: 0.5,
        papertint: 0,
        vignette: 0,
        dyebleed: 0,
        distressed: 0,
        preserveskin: 0,
        washcolor: "#6a11cb",
        washintensity: 0,
        sharpness: 0,
        saturation: 1.0,
        halftone: 0
      };

      this.controlConfig = {
        texturetype: { type: "select", group: "Texture", label: "Texture Style", options: ["Canvas", "Paper", "Ink Wash", "Clay", "Linocut", "Leather", "Slate", "Mosaic", "Canvas 2"], value: 0, min: 0, max: 8, step: 1, suffix: "" },
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

        brightness: { type: "range", group: "Color", label: "Brightness", min: 0.2, max: 3, step: 0.01, value: 1, suffix: "" },
        contrast: { type: "range", group: "Color", label: "Contrast", min: 0.5, max: 2, step: 0.01, value: 1.08, suffix: "" },
        saturation: { type: "range", group: "Color", label: "Saturation", min: 0, max: 3, step: 0.01, value: 1.0, suffix: "" },
        papertint: { type: "range", group: "Color", label: "Paper Tint", min: 0, max: 1, step: 0.01, value: 0, suffix: "" },
        colorscale: { type: "range", group: "Color", label: "Color → Scale", min: -1, max: 1, step: 0.01, value: 0, suffix: "" },
        colordepth: { type: "range", group: "Color", label: "Color → Depth", min: -1, max: 1, step: 0.01, value: 0, suffix: "" },

        vignette: { type: "range", group: "Effects", label: "Edge Vignette", min: 0, max: 1, step: 0.01, value: 0, suffix: "" },
        dyebleed: { type: "checkbox", group: "Effects", label: "Dye Bleed", min: 0, max: 1, step: 1, value: 0, suffix: "" },
        distressed: { type: "checkbox", group: "Effects", label: "Distressed", min: 0, max: 1, step: 1, value: 0, suffix: "" },
        preserveskin: { type: "checkbox", group: "Effects", label: "Preserve Skin", min: 0, max: 1, step: 1, value: 0, suffix: "" },
        washcolor: { type: "color", group: "Effects", label: "Wash Color", value: "#6a11cb" },
        washintensity: { type: "range", group: "Effects", label: "Wash Intensity", min: 0, max: 1, step: 0.01, value: 0, suffix: "" },
        sharpness: { type: "range", group: "Effects", label: "Sharpness", min: 0, max: 2, step: 0.01, value: 0, suffix: "" },
        halftone: { type: "range", group: "Effects", label: "Halftone", min: 0, max: 1, step: 0.01, value: 0, suffix: "" }
      };

      this.groupOrder = ["Texture", "Lighting", "Color", "Effects"];

      this.styleDefaults = {
        0: { scale: 36, depth: 0.65, soften: 0.25, papertint: 0.0, ao: 0.5 },
        1: { scale: 80, depth: 0.40, soften: 0.60, papertint: 0.30, ao: 0.40 },
        2: { scale: 8,  depth: 0.20, soften: 0.90, papertint: 0.20, ao: 0.20 },
        3: { scale: 25, depth: 0.80, soften: 0.35, papertint: 0.15, ao: 0.70 },
        4: { scale: 30, depth: 0.30, soften: 0.40, papertint: 0.00, ao: 0.30 },
        5: { scale: 12, depth: 1.00, soften: 0.45, papertint: 0.40, ao: 0.60 },
        6: { scale: 40, depth: 0.50, soften: 0.50, papertint: 0.25, ao: 0.30 },
        7: { scale: 18, depth: 0.70, soften: 0.30, papertint: 0.10, ao: 0.80 },
        8: { scale: 28, depth: 0.85, soften: 0.40, papertint: 0.15, ao: 0.65 }
      };

      this.boundHandleFileChange = this.handleFileChange.bind(this);
      this.boundDownload = this.download.bind(this);
      this.boundReset = this.resetControls.bind(this);
      
      this.boundSavePreset = this.handleSavePreset.bind(this);
      this.boundLoadPreset = this.handleLoadPreset.bind(this);
      this.boundDeletePreset = this.handleDeletePreset.bind(this);
      this.boundBatchClick = this.handleBatchClick.bind(this);
      this.boundBatchFolderSelect = this.handleBatchFolderSelected.bind(this);
      this.boundExcludeColorClick = () => this.startColorPick("exclude");
      this.boundIncludeColorClick = () => this.startColorPick("include");
      this.boundOriginalImageClick = this.handleOriginalImageClick.bind(this);
      this.presets = {};
      this.batchRunning = false;
      this.excludedColors = [];
      this.includedColors = [];
      this.pickMode = null;
      this.pickInterval = null;
      this.MAX_PICKED_COLORS = 8;
    }

    connectedCallback() {
      this.renderTemplate();
      this.cacheElements();
      this.loadPresetsFromStorage();
      this.loadColorMasks();
      this.updateChipsUI();
      this.bindUiEvents();
      this.applyInitialAttributes();
      this.loadRecentSettings();
      this.initWebGL();
      this.setupResizeObserver();
      this.resizeCanvasBackingStore();
      this.requestRender();
      this.isReady = true;
      this.loadRecentImage();
    }

    disconnectedCallback() {
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }

      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = 0;
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }

      if (name === "image-data") {
        if (newValue) {
          this.loadImageFromDataUrl(newValue);
        } else {
          this.clearImage();
        }
        return;
      }

      if (name === "export-request") {
        this.download();
        return;
      }

      if (Object.prototype.hasOwnProperty.call(this.controlConfig, name)) {
        this.setParamFromAttribute(name, newValue);
        this.syncControl(name);
        this.requestRender();
        if (this.isReady) {
          this.saveRecentSettings();
        }
      }
    }

    renderTemplate() {
      const buildControl = (name, config) => {
        if (config.type === "checkbox") {
          return `
            <label class="control checkbox-control" data-control="${name}">
              <span class="control-topline">
                <span class="control-label" data-reset="${name}" title="Double-click to reset">${config.label}</span>
                <input
                  id="${name}Input"
                  type="checkbox"
                  ${config.value ? "checked" : ""}
                  data-param="${name}"
                />
              </span>
            </label>
          `;
        }
        if (config.type === "select") {
          const options = config.options.map((opt, i) => `<option value="${i}" ${config.value === i ? "selected" : ""}>${opt}</option>`).join("");
          return `
            <label class="control" data-control="${name}">
              <span class="control-topline">
                <span class="control-label" data-reset="${name}" title="Double-click to reset">${config.label}</span>
              </span>
              <select id="${name}Input" data-param="${name}" class="control-select">
                ${options}
              </select>
            </label>
          `;
        }
        if (config.type === "color") {
          return `
            <label class="control" data-control="${name}">
              <span class="control-topline">
                <span class="control-label" data-reset="${name}" title="Double-click to reset">${config.label}</span>
                <input
                  id="${name}Input"
                  type="color"
                  value="${config.value}"
                  data-param="${name}"
                  style="width: 32px; height: 32px; padding: 0; border: none; border-radius: 4px; cursor: pointer;"
                />
              </span>
            </label>
          `;
        }
        return `
          <label class="control" data-control="${name}">
            <span class="control-topline">
              <span class="control-label" data-reset="${name}" title="Double-click to reset">${config.label}</span>
              <input
                id="${name}NumInput"
                type="number"
                class="control-number"
                min="${config.min}"
                max="${config.max}"
                step="${config.step}"
                value="${config.value}"
                data-num-param="${name}"
                aria-label="${config.label} value"
              />
            </span>
            <input
              id="${name}Input"
              type="range"
              min="${config.min}"
              max="${config.max}"
              step="${config.step}"
              value="${config.value}"
              data-param="${name}"
            />
          </label>
        `;
      };

      const grouped = {};
      Object.entries(this.controlConfig).forEach(([name, config]) => {
        const g = config.group || "Other";
        if (!grouped[g]) grouped[g] = [];
        grouped[g].push([name, config]);
      });

      const groupOrder = this.groupOrder.concat(
        Object.keys(grouped).filter((g) => !this.groupOrder.includes(g))
      );

      const controlsMarkup = groupOrder
        .filter((g) => grouped[g])
        .map((g) => {
          const items = grouped[g].map(([name, cfg]) => buildControl(name, cfg)).join("");
          return `
            <details class="control-group" open data-group="${g}">
              <summary class="control-group-title">${g}</summary>
              <div class="control-group-body">${items}</div>
            </details>
          `;
        })
        .join("");

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            width: 100%;
            min-height: 620px;
            box-sizing: border-box;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #1f2933;
            background: transparent;
          }

          *, *::before, *::after {
            box-sizing: border-box;
          }

          .filter-shell {
            display: grid;
            grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
            gap: 18px;
            width: 100%;
            min-height: 620px;
          }

          .panel,
          .preview-panel {
            border: 1px solid rgba(31, 41, 51, 0.12);
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.96);
            box-shadow: 0 12px 36px rgba(15, 23, 42, 0.08);
          }

          .panel {
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .title {
            margin: 0;
            font-size: 20px;
            line-height: 1.2;
            font-weight: 750;
            letter-spacing: -0.02em;
          }

          .subtitle {
            margin: -8px 0 2px;
            font-size: 13px;
            line-height: 1.45;
            color: #64748b;
          }

          .file-picker {
            display: grid;
            gap: 10px;
            padding: 14px;
            border-radius: 14px;
            border: 1px dashed rgba(31, 41, 51, 0.22);
            background: #f8fafc;
          }

          .file-picker span {
            font-size: 13px;
            font-weight: 650;
          }

          input[type="file"] {
            width: 100%;
            font-size: 13px;
          }

          .controls {
            display: grid;
            gap: 8px;
          }

          .control-group {
            border-radius: 12px;
            background: rgba(241, 245, 249, 0.55);
            border: 1px solid rgba(31, 41, 51, 0.07);
            overflow: hidden;
          }

          .control-group-title {
            cursor: pointer;
            padding: 10px 14px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #475569;
            user-select: none;
            list-style: none;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .control-group-title::-webkit-details-marker {
            display: none;
          }

          .control-group-title::before {
            content: "";
            width: 0;
            height: 0;
            border-left: 5px solid currentColor;
            border-top: 4px solid transparent;
            border-bottom: 4px solid transparent;
            transition: transform 150ms ease;
          }

          .control-group[open] > .control-group-title::before {
            transform: rotate(90deg);
          }

          .control-group-body {
            padding: 2px 14px 14px;
            display: grid;
            gap: 13px;
          }

          .control {
            display: grid;
            gap: 7px;
          }

          .control-topline {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            font-size: 13px;
            font-weight: 650;
            align-items: center;
          }

          .control-label {
            cursor: pointer;
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .control-number {
            width: 64px;
            padding: 3px 6px;
            border-radius: 6px;
            border: 1px solid rgba(31, 41, 51, 0.18);
            font: inherit;
            font-size: 12px;
            text-align: right;
            background: #fff;
            color: #1f2933;
            font-variant-numeric: tabular-nums;
          }

          .control-number:focus {
            outline: 2px solid #0f766e;
            outline-offset: -1px;
          }

          .checkbox-control .control-topline {
            align-items: center;
          }

          input[type="checkbox"] {
            width: 18px;
            height: 18px;
            accent-color: #0f766e;
            cursor: pointer;
            margin: 0;
          }

          .control-select {
            width: 100%;
            padding: 8px 12px;
            border-radius: 8px;
            border: 1px solid rgba(31, 41, 51, 0.2);
            font: inherit;
            font-size: 13px;
            background: #fff;
            color: #1f2933;
          }
          .control-select:focus {
            outline: 2px solid #0f766e;
            outline-offset: -1px;
          }

          output {
            color: #475569;
            font-variant-numeric: tabular-nums;
          }

          input[type="range"] {
            width: 100%;
            accent-color: #0f766e;
          }

          .buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: auto;
          }

          button {
            border: 0;
            border-radius: 12px;
            padding: 11px 12px;
            font: inherit;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            transition: transform 120ms ease, opacity 120ms ease, background 120ms ease;
          }

          button:active {
            transform: translateY(1px);
          }

          button:disabled {
            cursor: not-allowed;
            opacity: 0.48;
          }

          .download-button {
            color: white;
            background: #0f766e;
          }

          .reset-button {
            color: #0f172a;
            background: #e2e8f0;
          }

          .status {
            min-height: 18px;
            font-size: 12px;
            color: #64748b;
            line-height: 1.4;
          }

          .presets-container {
            display: grid;
            gap: 10px;
            padding-top: 14px;
            border-top: 1px solid rgba(31, 41, 51, 0.1);
          }

          .presets-row {
            display: flex;
            gap: 8px;
          }

          .preset-select, .preset-input {
            flex: 1;
            padding: 8px 12px;
            border-radius: 8px;
            border: 1px solid rgba(31, 41, 51, 0.2);
            font: inherit;
            font-size: 13px;
            background: #fff;
            min-width: 0;
          }

          .preset-select:focus, .preset-input:focus {
            outline: 2px solid #0f766e;
            outline-offset: -1px;
          }

          .action-button {
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            background: #f1f5f9;
            color: #0f172a;
            border: 0;
            cursor: pointer;
            transition: opacity 120ms ease;
          }
          
          .icon-button {
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            background: #fee2e2;
            color: #b91c1c;
            line-height: 1;
            border: 0;
            cursor: pointer;
            transition: opacity 120ms ease;
          }
          
          .icon-button:disabled, .action-button:disabled {
            background: #f1f5f9;
            color: #94a3b8;
            cursor: not-allowed;
          }

          .masks-row {
            display: flex;
            gap: 8px;
          }

          .masks-row .action-button {
            flex: 1;
          }

          .chips-section {
            display: grid;
            gap: 4px;
          }

          .chips-label {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: #64748b;
          }

          .color-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            min-height: 24px;
            align-items: center;
          }

          .chips-empty {
            font-size: 12px;
            color: #94a3b8;
            font-style: italic;
          }

          .color-chip {
            width: 26px;
            height: 26px;
            border-radius: 50%;
            border: 1px solid rgba(31, 41, 51, 0.25);
            padding: 0;
            cursor: pointer;
            position: relative;
            transition: transform 100ms ease;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.15);
          }

          .color-chip:hover {
            transform: scale(1.1);
          }

          .color-chip::after {
            content: "×";
            position: absolute;
            top: -5px;
            right: -5px;
            width: 14px;
            height: 14px;
            background: #b91c1c;
            color: white;
            font-size: 11px;
            line-height: 1;
            border-radius: 50%;
            display: grid;
            place-items: center;
            opacity: 0;
            transition: opacity 100ms ease;
            font-weight: 700;
          }

          .color-chip:hover::after {
            opacity: 1;
          }

          :host([data-picking="true"]) img#originalImage {
            cursor: crosshair !important;
            outline: 2px dashed #0f766e;
            outline-offset: -2px;
          }

          .preview-panel {
            position: relative;
            min-width: 0;
            min-height: 620px;
            padding: 14px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            background:
              linear-gradient(45deg, #f1f5f9 25%, transparent 25%),
              linear-gradient(-45deg, #f1f5f9 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #f1f5f9 75%),
              linear-gradient(-45deg, transparent 75%, #f1f5f9 75%);
            background-size: 24px 24px;
            background-position: 0 0, 0 12px, 12px -12px, -12px 0;
          }

          .canvas-wrap, .image-wrap {
            position: relative;
            min-width: 0;
            min-height: 360px;
            display: grid;
            place-items: center;
            overflow: hidden;
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.68);
          }

          canvas, img#originalImage {
            display: block;
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
          }

          .empty-state {
            position: absolute;
            inset: 0;
            display: grid;
            place-items: center;
            padding: 24px;
            text-align: center;
            color: #64748b;
            pointer-events: none;
            z-index: 10;
          }

          .empty-card {
            max-width: 420px;
            padding: 22px;
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.88);
            border: 1px solid rgba(31, 41, 51, 0.1);
          }

          .empty-card strong {
            display: block;
            margin-bottom: 6px;
            color: #1f2933;
            font-size: 16px;
          }

          :host([data-has-image="true"]) .empty-state {
            display: none;
          }

          :host(:not([data-has-image="true"])) .image-wrap,
          :host(:not([data-has-image="true"])) .canvas-wrap {
            display: none;
          }

          @media (max-width: 780px) {
            .filter-shell {
              grid-template-columns: 1fr;
            }

            .preview-panel {
              grid-template-columns: 1fr;
              grid-template-rows: 1fr 1fr;
              min-height: 420px;
            }
          }
        </style>

        <div class="filter-shell">
          <aside class="panel" aria-label="Texture filter controls">
            <h2 class="title">Canvas Texturizer</h2>
            <p class="subtitle">Upload an image, then tune the woven bump texture in real time.</p>

            <label class="file-picker">
              <span>Image</span>
              <input id="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" />
            </label>

            <div class="panel-toggles" style="display: flex; gap: 8px; margin-bottom: 12px;">
              <button id="btnOpenAll" class="action-button" type="button" style="flex: 1; padding: 6px; font-size: 11px;">Expand All</button>
              <button id="btnCloseAll" class="action-button" type="button" style="flex: 1; padding: 6px; font-size: 11px;">Collapse All</button>
            </div>
            <div class="controls">
              ${controlsMarkup}
            </div>

            <details class="control-group" open data-group="Color Masks">
              <summary class="control-group-title">Color Masks</summary>
              <div class="control-group-body">
                <div class="masks-row">
                  <button id="excludeColorButton" class="action-button" type="button">Exclude Color…</button>
                  <button id="includeColorButton" class="action-button" type="button">Include Color…</button>
                </div>
                <div class="chips-section">
                  <div class="chips-label">Excluded</div>
                  <div id="excludedChips" class="color-chips" data-empty-label="None"></div>
                </div>
                <div class="chips-section">
                  <div class="chips-label">Included</div>
                  <div id="includedChips" class="color-chips" data-empty-label="None"></div>
                </div>
              </div>
            </details>

            <div class="presets-container">
              <label class="control-topline" style="font-weight: 650; font-size: 13px;">Presets</label>
              <div class="presets-row">
                <select id="presetSelect" class="preset-select">
                  <option value="">-- Load a preset --</option>
                </select>
                <button id="deletePresetButton" class="icon-button" type="button" aria-label="Delete Preset" disabled>×</button>
              </div>
              <div class="presets-row">
                <input id="presetNameInput" type="text" placeholder="Preset Name" class="preset-input" />
                <button id="savePresetButton" class="action-button" type="button">Save</button>
              </div>
              <div class="presets-row">
                <input id="batchFolderInput" type="file" webkitdirectory directory multiple style="display:none;" />
                <button id="batchButton" class="action-button" type="button" style="flex:1;">Batch Convert Folder…</button>
              </div>
            </div>

            <div class="buttons">
              <button id="downloadButton" class="download-button" type="button" disabled>Download PNG</button>
              <button id="resetButton" class="reset-button" type="button">Reset</button>
            </div>

            <div id="status" class="status" role="status" aria-live="polite">Choose an image to begin.</div>
          </aside>

          <section class="preview-panel" aria-label="Texture filter preview">
            <div class="empty-state">
              <div class="empty-card">
                <strong>No image loaded</strong>
                <span>The GPU preview will appear here after you choose a local image.</span>
              </div>
            </div>
            <div class="image-wrap">
              <img id="originalImage" alt="Original Image" />
            </div>
            <div class="canvas-wrap">
              <canvas id="canvas"></canvas>
            </div>
          </section>
        </div>
      `;
    }

    cacheElements() {
      this.canvas = this.shadowRoot.getElementById("canvas");
      this.originalImage = this.shadowRoot.getElementById("originalImage");
      this.fileInput = this.shadowRoot.getElementById("fileInput");
      this.downloadButton = this.shadowRoot.getElementById("downloadButton");
      this.resetButton = this.shadowRoot.getElementById("resetButton");
      this.statusEl = this.shadowRoot.getElementById("status");
      this.presetSelect = this.shadowRoot.getElementById("presetSelect");
      this.presetNameInput = this.shadowRoot.getElementById("presetNameInput");
      this.savePresetButton = this.shadowRoot.getElementById("savePresetButton");
      this.deletePresetButton = this.shadowRoot.getElementById("deletePresetButton");
      this.batchButton = this.shadowRoot.getElementById("batchButton");
      this.batchFolderInput = this.shadowRoot.getElementById("batchFolderInput");
      this.excludeColorButton = this.shadowRoot.getElementById("excludeColorButton");
      this.includeColorButton = this.shadowRoot.getElementById("includeColorButton");
      this.btnOpenAll = this.shadowRoot.getElementById("btnOpenAll");
      this.btnCloseAll = this.shadowRoot.getElementById("btnCloseAll");
      this.excludedChips = this.shadowRoot.getElementById("excludedChips");
      this.includedChips = this.shadowRoot.getElementById("includedChips");
      this.inputs = {};
      this.numInputs = {};
      this.labels = {};

      Object.keys(this.controlConfig).forEach((name) => {
        this.inputs[name] = this.shadowRoot.getElementById(`${name}Input`);
        this.numInputs[name] = this.shadowRoot.getElementById(`${name}NumInput`);
        this.labels[name] = this.shadowRoot.querySelector(`[data-reset="${name}"]`);
      });
    }

    bindUiEvents() {
      this.fileInput.addEventListener("change", this.boundHandleFileChange);
      this.downloadButton.addEventListener("click", this.boundDownload);
      this.resetButton.addEventListener("click", this.boundReset);
      
      this.savePresetButton.addEventListener("click", this.boundSavePreset);
      this.presetSelect.addEventListener("change", this.boundLoadPreset);
      this.deletePresetButton.addEventListener("click", this.boundDeletePreset);
      this.batchButton.addEventListener("click", this.boundBatchClick);
      this.batchFolderInput.addEventListener("change", this.boundBatchFolderSelect);
      this.excludeColorButton.addEventListener("click", this.boundExcludeColorClick);
      this.includeColorButton.addEventListener("click", this.boundIncludeColorClick);
      this.originalImage.addEventListener("click", this.boundOriginalImageClick);
      
      this.btnOpenAll.addEventListener("click", () => {
        this.shadowRoot.querySelectorAll(".control-group").forEach(el => el.setAttribute("open", ""));
      });
      
      this.btnCloseAll.addEventListener("click", () => {
        this.shadowRoot.querySelectorAll(".control-group").forEach(el => el.removeAttribute("open"));
      });

      Object.entries(this.inputs).forEach(([name, input]) => {
        if (!input) return;
        if (input.type === "checkbox") {
          input.addEventListener("change", () => {
            this.setAttribute(name, input.checked ? "1" : "0");
          });
        } else if (input.tagName === "SELECT") {
          input.addEventListener("change", () => {
            this.setAttribute(name, input.value);
            if (name === "texturetype") {
              this.applyStyleDefaults(Number(input.value));
            }
          });
        } else {
          input.addEventListener("input", () => {
            this.setAttribute(name, input.value);
          });
        }
      });

      Object.entries(this.numInputs).forEach(([name, numInput]) => {
        if (!numInput) return;
        const commit = () => {
          const raw = numInput.value.trim();
          if (raw === "") return;
          const n = Number(raw);
          if (!Number.isFinite(n)) return;
          const config = this.controlConfig[name];
          const clamped = Math.min(config.max, Math.max(config.min, n));
          this.setAttribute(name, String(clamped));
        };
        numInput.addEventListener("change", commit);
        numInput.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            commit();
            numInput.blur();
          }
        });
      });

      Object.entries(this.labels).forEach(([name, label]) => {
        if (!label) return;
        label.addEventListener("dblclick", () => {
          this.setAttribute(name, String(this.controlConfig[name].value));
        });
      });
    }

    loadPresetsFromStorage() {
      try {
        const stored = localStorage.getItem("canvas-filter-presets");
        if (stored) {
          this.presets = JSON.parse(stored);
        } else {
          this.presets = {};
        }
      } catch (e) {
        this.presets = {};
      }
      this.updatePresetDropdown();
    }

    savePresetsToStorage() {
      try {
        localStorage.setItem("canvas-filter-presets", JSON.stringify(this.presets));
      } catch (e) {
        console.error("Failed to save presets", e);
      }
    }

    updatePresetDropdown() {
      this.presetSelect.innerHTML = '<option value="">-- Load a preset --</option>';
      for (const name of Object.keys(this.presets)) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        this.presetSelect.appendChild(option);
      }
      this.presetSelect.value = "";
      this.deletePresetButton.disabled = true;
    }

    handleSavePreset() {
      const name = this.presetNameInput.value.trim();
      if (!name) {
        this.setStatus("Please enter a name for the preset.", true);
        return;
      }
      
      const currentConfig = {};
      Object.keys(this.controlConfig).forEach(key => {
        currentConfig[key] = this.params[key];
      });
      
      this.presets[name] = currentConfig;
      this.savePresetsToStorage();
      this.updatePresetDropdown();
      this.presetSelect.value = name;
      this.deletePresetButton.disabled = false;
      this.presetNameInput.value = "";
      this.setStatus(`Saved preset "${name}".`);
    }

    handleLoadPreset() {
      const name = this.presetSelect.value;
      if (!name || !this.presets[name]) {
        this.deletePresetButton.disabled = true;
        return;
      }
      
      this.deletePresetButton.disabled = false;
      const config = this.presets[name];
      
      Object.keys(this.controlConfig).forEach(key => {
        if (config[key] !== undefined) {
          this.setAttribute(key, config[key]);
        }
      });
      this.requestRender();
      this.setStatus(`Loaded preset "${name}".`);
    }

    handleDeletePreset() {
      const name = this.presetSelect.value;
      if (!name || !this.presets[name]) return;

      delete this.presets[name];
      this.savePresetsToStorage();
      this.updatePresetDropdown();
      this.setStatus(`Deleted preset "${name}".`);
    }

    loadJSZip() {
      if (window.JSZip) return Promise.resolve(window.JSZip);
      if (this._jszipPromise) return this._jszipPromise;
      this._jszipPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
        script.onload = () => {
          if (window.JSZip) resolve(window.JSZip);
          else reject(new Error("JSZip loaded but global not found"));
        };
        script.onerror = () => reject(new Error("Failed to load JSZip from CDN"));
        document.head.appendChild(script);
      });
      return this._jszipPromise;
    }

    handleBatchClick() {
      if (this.batchRunning) return;
      this.batchFolderInput.value = "";
      this.batchFolderInput.click();
    }

    async handleBatchFolderSelected(event) {
      const fileList = event.target.files;
      if (!fileList || fileList.length === 0) return;

      const files = Array.from(fileList)
        .filter((f) => f.type && f.type.startsWith("image/"))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (files.length === 0) {
        this.setStatus("No images found in that folder.", true);
        event.target.value = "";
        return;
      }

      if (!this.gl || !this.program) {
        this.setStatus("WebGL not ready yet — try again in a moment.", true);
        event.target.value = "";
        return;
      }

      this.batchRunning = true;
      this.batchButton.disabled = true;
      this.fileInput.disabled = true;
      this.downloadButton.disabled = true;
      this.resetButton.disabled = true;

      const savedDataUrl = this.image ? this.originalImage.src : null;
      const savedFilename = this.originalFilename;

      let JSZipCtor;
      try {
        this.setStatus("Loading zip library…");
        JSZipCtor = await this.loadJSZip();
      } catch (e) {
        this.setStatus("Could not load zip library. Check connection.", true);
        this.finishBatch(savedDataUrl, savedFilename, event.target);
        return;
      }

      const zip = new JSZipCtor();
      let processed = 0;
      let errored = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        this.setStatus(`Processing ${i + 1} of ${files.length}: ${file.name}…`);
        await new Promise((r) => requestAnimationFrame(r));
        try {
          const blob = await this.processImageForBatch(file);
          if (blob) {
            const stem = file.name.replace(/\.[^.]+$/, "");
            zip.file(`${stem}-texturized.png`, blob);
            processed++;
          } else {
            errored++;
          }
        } catch (e) {
          errored++;
          console.warn("Batch error on", file.name, e);
        }
      }

      if (processed === 0) {
        this.setStatus(`Batch failed: no images could be processed (${errored} errored).`, true);
        this.finishBatch(savedDataUrl, savedFilename, event.target);
        return;
      }

      this.setStatus(`Building zip (${processed} images)…`);
      try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, "").replace(/[:T]/g, "-");
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `texturized-batch-${stamp}.zip`;
        link.rel = "noopener";
        link.style.display = "none";
        this.shadowRoot.appendChild(link);
        link.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          link.remove();
        }, 1000);

        const skipNote = errored > 0 ? `, ${errored} skipped` : "";
        this.setStatus(`Batch complete. ${processed} converted${skipNote}. Zip downloaded.`);
      } catch (e) {
        this.setStatus(`Failed to build zip: ${e.message}`, true);
      }

      this.finishBatch(savedDataUrl, savedFilename, event.target);
    }

    finishBatch(savedDataUrl, savedFilename, inputEl) {
      this.batchRunning = false;
      this.batchButton.disabled = false;
      this.fileInput.disabled = false;
      this.resetButton.disabled = false;
      if (inputEl) inputEl.value = "";

      if (savedDataUrl) {
        this.loadImageFromDataUrl(savedDataUrl, savedFilename || "image", true);
      } else {
        this.downloadButton.disabled = !this.image;
      }
    }

    loadColorMasks() {
      try {
        const raw = localStorage.getItem("canvas-filter-color-masks");
        if (!raw) return;
        const obj = JSON.parse(raw);
        if (Array.isArray(obj.exclude)) this.excludedColors = obj.exclude.slice(0, this.MAX_PICKED_COLORS);
        if (Array.isArray(obj.include)) this.includedColors = obj.include.slice(0, this.MAX_PICKED_COLORS);
      } catch (e) {}
    }

    saveColorMasks() {
      try {
        localStorage.setItem("canvas-filter-color-masks", JSON.stringify({
          exclude: this.excludedColors,
          include: this.includedColors
        }));
      } catch (e) {}
    }

    rgbToCbCr(r, g, b) {
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      return { cb, cr };
    }

    updateChipsUI() {
      const buildChips = (list, mode, container) => {
        if (!container) return;
        container.innerHTML = "";
        if (list.length === 0) {
          const empty = document.createElement("span");
          empty.className = "chips-empty";
          empty.textContent = container.dataset.emptyLabel || "None";
          container.appendChild(empty);
          return;
        }
        list.forEach((color, i) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "color-chip";
          chip.style.background = `rgb(${color.r}, ${color.g}, ${color.b})`;
          chip.title = `rgb(${color.r}, ${color.g}, ${color.b}) — click to remove`;
          chip.addEventListener("click", () => this.removePickedColor(mode, i));
          container.appendChild(chip);
        });
      };
      buildChips(this.excludedColors, "exclude", this.excludedChips);
      buildChips(this.includedColors, "include", this.includedChips);
    }

    startColorPick(mode) {
      if (!this.image) {
        this.setStatus("Load an image first.", true);
        return;
      }
      if (this.pickMode === mode) {
        this.finishColorPick(false);
        return;
      }
      if (this.pickMode) {
        this.finishColorPick(false);
      }
      this.pickMode = mode;
      this.setAttribute("data-picking", "true");
      let remaining = 5;
      const label = mode === "exclude" ? "exclude" : "include";
      this.setStatus(`Click a color on the original image to ${label} (${remaining}s)…`);
      this.pickInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          this.finishColorPick(false);
          return;
        }
        this.setStatus(`Click a color on the original image to ${label} (${remaining}s)…`);
      }, 1000);
    }

    finishColorPick(picked) {
      if (this.pickInterval) {
        clearInterval(this.pickInterval);
        this.pickInterval = null;
      }
      const wasInMode = this.pickMode;
      this.pickMode = null;
      this.removeAttribute("data-picking");
      if (wasInMode && !picked) {
        this.setStatus("No color picked.");
      }
    }

    handleOriginalImageClick(event) {
      if (!this.pickMode) return;
      event.preventDefault();
      event.stopPropagation();
      const pixel = this.getImagePixelAt(event.clientX, event.clientY);
      if (!pixel) {
        this.setStatus("Could not read pixel color.", true);
        this.finishColorPick(true);
        return;
      }
      this.addPickedColor(pixel, this.pickMode);
      const action = this.pickMode === "exclude" ? "Excluded" : "Included";
      this.setStatus(`${action} color rgb(${pixel.r}, ${pixel.g}, ${pixel.b}).`);
      this.finishColorPick(true);
    }

    getImagePixelAt(clientX, clientY) {
      if (!this.image || !this.textureSource) return null;
      const rect = this.originalImage.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const xRel = (clientX - rect.left) / rect.width;
      const yRel = (clientY - rect.top) / rect.height;
      if (xRel < 0 || xRel > 1 || yRel < 0 || yRel > 1) return null;

      const w = this.textureWidth;
      const h = this.textureHeight;
      const px = Math.max(0, Math.min(w - 1, Math.floor(xRel * w)));
      const py = Math.max(0, Math.min(h - 1, Math.floor(yRel * h)));

      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const ctx = off.getContext("2d", { willReadFrequently: false });
      try {
        ctx.drawImage(this.textureSource, 0, 0, w, h);
        const data = ctx.getImageData(px, py, 1, 1).data;
        return { r: data[0], g: data[1], b: data[2] };
      } catch (e) {
        return null;
      }
    }

    addPickedColor(rgb, mode) {
      const { cb, cr } = this.rgbToCbCr(rgb.r, rgb.g, rgb.b);
      const entry = { r: rgb.r, g: rgb.g, b: rgb.b, cb, cr };
      const list = mode === "exclude" ? this.excludedColors : this.includedColors;
      if (list.length >= this.MAX_PICKED_COLORS) list.shift();
      list.push(entry);
      this.updateChipsUI();
      this.saveColorMasks();
      this.requestRender();
    }

    removePickedColor(mode, index) {
      const list = mode === "exclude" ? this.excludedColors : this.includedColors;
      if (index < 0 || index >= list.length) return;
      list.splice(index, 1);
      this.updateChipsUI();
      this.saveColorMasks();
      this.requestRender();
    }

    async processImageForBatch(file) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => reject(reader.error || new Error("Read failed"));
        reader.readAsDataURL(file);
      });
      if (!dataUrl) return null;

      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("Decode failed"));
        i.src = dataUrl;
      });

      this.image = img;
      this.originalFilename = file.name;
      this.uploadImageTexture();
      this.resizeCanvasBackingStore();
      this.renderCanvas();
      this.gl.finish();

      return await new Promise((resolve) => {
        this.canvas.toBlob((blob) => resolve(blob), "image/png");
      });
    }

    applyInitialAttributes() {
      Object.keys(this.controlConfig).forEach((name) => {
        if (!this.hasAttribute(name)) {
          this.setAttribute(name, String(this.controlConfig[name].value));
        } else {
          this.setParamFromAttribute(name, this.getAttribute(name));
          this.syncControl(name);
        }
      });
    }

    applyStyleDefaults(styleIndex) {
      const defaults = this.styleDefaults[styleIndex];
      if (!defaults) return;
      Object.entries(defaults).forEach(([key, value]) => {
        this.setAttribute(key, String(value));
      });
    }

    initWebGL() {
      if (this.gl) {
        return;
      }

      const gl = this.canvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true
      });

      if (!gl) {
        this.setStatus("WebGL2 is not available in this browser.", true);
        this.emit("filter-error", { message: "WebGL2 is not available in this browser." });
        return;
      }

      this.gl = gl;
      this.maxTextureSize = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096);

      const vertexShaderSource = `#version 300 es
        precision highp float;

        in vec2 a_position;
        in vec2 a_uv;

        out vec2 v_uv;

        void main() {
          v_uv = a_uv;
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      const fragmentShaderSource = `#version 300 es
        precision highp float;

        uniform sampler2D u_image;
        uniform vec2 u_resolution;
        uniform float u_scale;
        uniform float u_depth;
        uniform float u_angle;
        uniform float u_intensity;
        uniform float u_soften;
        uniform float u_contrast;
        uniform float u_brightness;
        uniform float u_warp;
        uniform float u_colorscale;
        uniform float u_colordepth;
        uniform float u_shininess;
        uniform float u_lightazimuth;
        uniform float u_lightelevation;
        uniform float u_lighttint;
        uniform float u_paperTint;
        uniform float u_ao;
        uniform float u_vignette;
        uniform int u_textureType;
        uniform bool u_dyebleed;
        uniform bool u_distressed;
        uniform bool u_preserveskin;
        uniform int u_excludedCount;
        uniform vec2 u_excludedColors[8];
        uniform int u_includedCount;
        uniform vec2 u_includedColors[8];
        uniform bool u_hasImage;
        uniform float u_washintensity;
        uniform vec3 u_washcolor;
        uniform float u_sharpness;
        uniform float u_saturation;
        uniform float u_halftone;

        in vec2 v_uv;
        out vec4 outColor;

        const float PI = 3.1415926535897932384626433832795;

        mat2 rotate2d(float angle) {
          float s = sin(angle);
          float c = cos(angle);
          return mat2(c, -s, s, c);
        }

        float threadBand(float localPosition, float halfWidth, float softness) {
          return 1.0 - smoothstep(halfWidth, halfWidth + softness, abs(localPosition - 0.5));
        }

        // Random hash
        vec2 hash22(vec2 p) {
            p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
            return -1.0 + 2.0*fract(sin(p)*43758.5453123);
        }

        // Value noise
        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f*f*(3.0-2.0*f);
            return mix( mix( dot( hash22(i + vec2(0.0,0.0)), f - vec2(0.0,0.0) ), 
                             dot( hash22(i + vec2(1.0,0.0)), f - vec2(1.0,0.0) ), u.x),
                        mix( dot( hash22(i + vec2(0.0,1.0)), f - vec2(0.0,1.0) ), 
                             dot( hash22(i + vec2(1.0,1.0)), f - vec2(1.0,1.0) ), u.x), u.y);
        }

        // Fractal Brownian Motion
        float fbm(vec2 x) {
            float v = 0.0;
            float a = 0.5;
            vec2 shift = vec2(100.0);
            mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
            for (int i = 0; i < 5; ++i) {
                v += a * noise(x);
                x = rot * x * 2.0 + shift;
                a *= 0.5;
            }
            return v;
        }

        // Voronoi / Cellular noise
        float voronoi(vec2 x) {
            vec2 p = floor(x);
            vec2 f = fract(x);
            float res = 8.0;
            for(int j=-1; j<=1; j++)
            for(int i=-1; i<=1; i++) {
                vec2 b = vec2(i, j);
                vec2 r = vec2(b) - f + hash22(p + b)*0.5+0.5;
                float d = dot(r, r);
                res = min(res, d);
            }
            return sqrt(res);
        }

        float fiberNoise(float t, float lane) {
          float n1 = sin(t * PI * 8.0 + lane * 0.37);
          float n2 = sin(t * PI * 19.0 + lane * 1.73);
          float n3 = sin(t * PI * 41.0 + lane * 2.91);
          return 0.050 * n1 + 0.025 * n2 + 0.012 * n3;
        }

        vec2 getBaseP(vec2 uv, vec2 original_uv) {
           vec2 pixelSpace = (uv - 0.5) * u_resolution;
           float squareNormalizer = max(min(u_resolution.x, u_resolution.y), 1.0);
           vec2 squareSpace = pixelSpace / squareNormalizer;
           
           vec2 p = rotate2d(u_angle) * squareSpace;

           if (u_warp > 0.0) {
             p += vec2(fiberNoise(p.y * 3.0, 0.0), fiberNoise(p.x * 3.0, 1.0)) * 0.15 * u_warp;
           }
           
           float scaleMod = 1.0;
           if (u_hasImage && u_colorscale != 0.0) {
              float luma = dot(texture(u_image, original_uv).rgb, vec3(0.299, 0.587, 0.114));
              float targetScale = u_colorscale > 0.0 ? mix(0.5, 1.8, luma) : mix(1.8, 0.5, luma);
              scaleMod = mix(1.0, targetScale, abs(u_colorscale));
           }
           float scale = max(u_scale * scaleMod, 1.0);
           
           return p * scale;
        }

        float canvasHeightAt(vec2 p) {
          vec2 grid = p;
          vec2 cell = floor(grid);
          vec2 local = fract(grid);

          float softness = mix(0.006, 0.165, clamp(u_soften, 0.0, 1.0));
          float halfWidth = 0.355;

          float horizontalMask = threadBand(local.y, halfWidth, softness);
          float verticalMask = threadBand(local.x, halfWidth, softness);

          float horizontalCrown = pow(max(sin(local.y * PI), 0.0), 0.42);
          float verticalCrown = pow(max(sin(local.x * PI), 0.0), 0.42);

          float horizontalFiber = fiberNoise(local.x, cell.y);
          float verticalFiber = fiberNoise(local.y, cell.x);

          float horizontalThread = horizontalMask * clamp(0.72 * horizontalCrown + 0.28 + horizontalFiber, 0.0, 1.0);
          float verticalThread = verticalMask * clamp(0.72 * verticalCrown + 0.28 + verticalFiber, 0.0, 1.0);

          vec2 basketBlock = floor(grid * 0.5);
          float horizontalOver = step(0.5, mod(basketBlock.x + basketBlock.y, 2.0));

          float intersection = horizontalMask * verticalMask;
          float topThread = mix(verticalThread, horizontalThread, horizontalOver);
          float lowerThread = mix(horizontalThread, verticalThread, horizontalOver) * 0.38;

          float crossingHeight = max(topThread, lowerThread);
          float singleStrandHeight = max(horizontalThread, verticalThread) * 0.78;

          float strandCoverage = clamp(horizontalMask + verticalMask, 0.0, 1.0);
          float groove = (1.0 - strandCoverage) * 0.09;

          float height = mix(singleStrandHeight, crossingHeight, intersection) - groove;

          if (u_distressed) {
            vec2 pnorm = grid / max(u_scale, 1.0);
            float wear = sin(pnorm.x * 2.3 + fiberNoise(pnorm.y, 0.0) * 10.0) * 
                         cos(pnorm.y * 2.7 + fiberNoise(pnorm.x, 1.0) * 10.0);
            wear = smoothstep(0.4, 0.9, wear);
            height = mix(height, 0.75, wear);
          }

          return clamp(height, 0.0, 1.0);
        }

        float paperHeightAt(vec2 p) {
            float n = fbm(p * 0.5);
            float fibers = fbm(p * 4.0);
            float height = 0.5 + n*0.15 + fibers*0.08;
            if (u_distressed) {
                height -= smoothstep(0.4, 0.8, fbm(p * 0.2)) * 0.3;
            }
            return clamp(height, 0.0, 1.0);
        }

        float inkWashHeightAt(vec2 p) {
            float n = fbm(p * 0.2);
            return clamp(0.5 + n*0.05, 0.0, 1.0);
        }

        float clayHeightAt(vec2 p) {
            float base = fbm(p * 0.3);
            float pores = voronoi(p * 2.0);
            float height = mix(1.0 - pores, 0.8, 0.6) + base * 0.2;
            if (u_distressed) {
                float cracks = 1.0 - voronoi(p * 0.5);
                cracks = smoothstep(0.9, 1.0, cracks);
                height -= cracks * 0.5;
            }
            return clamp(height, 0.0, 1.0);
        }

        float linocutHeightAt(vec2 p) {
            float n = fbm(p * 0.8);
            return clamp(0.5 + n * 0.1, 0.0, 1.0);
        }

        float leatherHeightAt(vec2 p) {
            float v1 = voronoi(p * 0.4);
            float v2 = voronoi(p * 1.2);
            float creases = 1.0 - (v1 * 0.6 + v2 * 0.4);
            creases = pow(creases, 1.5);
            float height = mix(0.4, 0.9, creases);
            if (u_distressed) {
                height -= smoothstep(0.3, 0.8, fbm(p * 0.5)) * 0.2;
            }
            return clamp(height, 0.0, 1.0);
        }

        float slateHeightAt(vec2 p) {
            float grit = noise(p * 5.0);
            float smudges = fbm(vec2(p.x * 0.05, p.y * 1.5));
            return clamp(0.5 + grit*0.05 + smudges*0.1, 0.0, 1.0);
        }

        float canvas2HeightAt(vec2 p) {
            vec2 jitter = vec2(fbm(p * 0.4), fbm(p * 0.4 + vec2(7.3, 2.1))) * 0.35;
            vec2 pj = p + jitter;

            float d = voronoi(pj);
            float falloff = mix(0.55, 0.35, clamp(u_soften, 0.0, 1.0));
            float bead = 1.0 - smoothstep(0.0, falloff, d);
            bead = sqrt(bead);

            float variation = fbm(p * 1.4) * 0.18;
            bead *= clamp(1.0 + variation, 0.7, 1.2);

            float fibers = noise(p * 6.0) * 0.05;
            bead += fibers * bead;

            if (u_distressed) {
                float wear = noise(p * 0.35);
                bead = mix(bead, bead * 0.3, smoothstep(0.45, 0.85, wear));
            }

            return clamp(bead, 0.0, 1.0);
        }

        float mosaicHeightAt(vec2 p) {
            vec2 pRot = rotate2d(PI/4.0) * p;
            
            vec2 grid1 = fract(p);
            vec2 cell1 = floor(p);
            vec2 grid2 = fract(pRot);
            vec2 cell2 = floor(pRot);
            
            float softness = mix(0.01, 0.1, clamp(u_soften, 0.0, 1.0));
            
            float g1x = threadBand(grid1.x, 0.45, softness);
            float g1y = threadBand(grid1.y, 0.45, softness);
            float g1 = g1x * g1y;
            
            float g2x = threadBand(grid2.x, 0.45, softness);
            float g2y = threadBand(grid2.y, 0.45, softness);
            float g2 = g2x * g2y;
            
            float isRotated = step(g1, g2);
            float tileTilt1 = dot(hash22(cell1), grid1 - 0.5) * 0.2;
            float tileTilt2 = dot(hash22(cell2), grid2 - 0.5) * 0.2;
            
            float tileHeight = mix(0.75 + tileTilt1, 0.75 + tileTilt2, isRotated);
            float grout = max(g1, g2);
            
            float height = mix(0.3, tileHeight, grout);
            
            if (u_distressed) {
                float wear = voronoi(p * 0.5);
                height -= smoothstep(0.7, 1.0, wear) * 0.4;
            }
            return clamp(height, 0.0, 1.0);
        }

        float getHeightAt(vec2 uv, vec2 original_uv) {
           vec2 p = getBaseP(uv, original_uv);
           
           if (u_textureType == 1) return paperHeightAt(p);
           if (u_textureType == 2) return inkWashHeightAt(p);
           if (u_textureType == 3) return clayHeightAt(p);
           if (u_textureType == 4) return linocutHeightAt(p);
           if (u_textureType == 5) return leatherHeightAt(p);
           if (u_textureType == 6) return slateHeightAt(p);
           if (u_textureType == 7) return mosaicHeightAt(p);
           if (u_textureType == 8) return canvas2HeightAt(p);

           return canvasHeightAt(p);
        }

        vec3 normalFromHeight(vec2 uv, vec2 original_uv) {
          vec2 texel = 1.0 / max(u_resolution, vec2(1.0));
          float radius = mix(0.85, 2.75, clamp(u_soften, 0.0, 1.0));

          float hL = getHeightAt(uv - vec2(texel.x * radius, 0.0), original_uv);
          float hR = getHeightAt(uv + vec2(texel.x * radius, 0.0), original_uv);
          float hD = getHeightAt(uv - vec2(0.0, texel.y * radius), original_uv);
          float hU = getHeightAt(uv + vec2(0.0, texel.y * radius), original_uv);

          float depthMod = 1.0;
          if (u_hasImage && u_colordepth != 0.0) {
            float luma = dot(texture(u_image, original_uv).rgb, vec3(0.299, 0.587, 0.114));
            float targetDepth = u_colordepth > 0.0 ? mix(1.8, 0.2, luma) : mix(0.2, 1.8, luma);
            depthMod = mix(1.0, targetDepth, abs(u_colordepth));
          }

          float strength = u_depth * 12.0 * depthMod;

          return normalize(vec3(
            (hL - hR) * strength,
            (hD - hU) * strength,
            1.0
          ));
        }

        vec3 rgb2hsv(vec3 c) {
            vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
            vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
            vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

            float d = q.x - min(q.w, q.y);
            float e = 1.0e-10;
            return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }

        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        vec3 applyBrightness(vec3 color, float amount) {
            if (amount == 1.0) return color;
            vec3 hsv = rgb2hsv(color);
            hsv.z = pow(hsv.z, 1.0 / amount);
            if (amount > 1.0) {
               hsv.y = clamp(hsv.y * (1.0 + (amount - 1.0) * 0.2), 0.0, 1.0);
            }
            return hsv2rgb(hsv);
        }

        vec3 applyContrast(vec3 color, float amount) {
          return clamp((color - 0.5) * amount + 0.5, 0.0, 1.0);
        }

        vec3 applySaturation(vec3 color, float amount) {
            float luma = dot(color, vec3(0.299, 0.587, 0.114));
            return mix(vec3(luma), color, amount);
        }

        vec3 paperColor(int t) {
          if (t == 1) return vec3(0.97, 0.94, 0.88);
          if (t == 2) return vec3(0.93, 0.92, 0.88);
          if (t == 3) return vec3(0.86, 0.72, 0.58);
          if (t == 4) return vec3(0.96, 0.95, 0.92);
          if (t == 5) return vec3(0.55, 0.40, 0.28);
          if (t == 6) return vec3(0.35, 0.37, 0.42);
          if (t == 7) return vec3(0.78, 0.75, 0.72);
          if (t == 8) return vec3(0.94, 0.90, 0.80);
          return vec3(0.95, 0.92, 0.84);
        }

        float skinMembership(vec3 rgb) {
          float R = rgb.r * 255.0;
          float G = rgb.g * 255.0;
          float B = rgb.b * 255.0;
          float Y  = 0.299 * R + 0.587 * G + 0.114 * B;
          float Cb = 128.0 - 0.168736 * R - 0.331264 * G + 0.5 * B;
          float Cr = 128.0 + 0.5 * R - 0.418688 * G - 0.081312 * B;

          float feather = 12.0;
          float cbLow  = clamp((Cb - (77.0  - feather)) / feather, 0.0, 1.0);
          float cbHigh = clamp(((135.0 + feather) - Cb) / feather, 0.0, 1.0);
          float crLow  = clamp((Cr - (133.0 - feather)) / feather, 0.0, 1.0);
          float crHigh = clamp(((180.0 + feather) - Cr) / feather, 0.0, 1.0);

          float m = cbLow * cbHigh * crLow * crHigh;
          float notTooDark = clamp((Y - 20.0) / 20.0, 0.0, 1.0);
          return m * notTooDark;
        }

        float computeAO(vec2 uv, vec2 original_uv, float hc) {
          vec2 texel = 1.0 / max(u_resolution, vec2(1.0));
          float r = 4.5;
          float s = 0.0;
          s += max(0.0, getHeightAt(uv + vec2(r * texel.x, 0.0), original_uv) - hc);
          s += max(0.0, getHeightAt(uv - vec2(r * texel.x, 0.0), original_uv) - hc);
          s += max(0.0, getHeightAt(uv + vec2(0.0, r * texel.y), original_uv) - hc);
          s += max(0.0, getHeightAt(uv - vec2(0.0, r * texel.y), original_uv) - hc);
          return clamp(1.0 - s * 0.6 * u_ao, 0.0, 1.0);
        }

        void main() {
          if (!u_hasImage) {
            outColor = vec4(0.0);
            return;
          }

          vec4 source;
          if (u_dyebleed) {
            vec2 p = getBaseP(v_uv, v_uv);
            vec2 blurDir;
            if (u_textureType == 0) {
                vec2 grid = p;
                vec2 basketBlock = floor(grid * 0.5);
                float horizontalOver = step(0.5, mod(basketBlock.x + basketBlock.y, 2.0));
                blurDir = mix(vec2(0.0, 1.0), vec2(1.0, 0.0), horizontalOver);
            } else {
                float angle = fbm(p * 0.1) * PI * 2.0;
                blurDir = vec2(cos(angle), sin(angle));
            }
            
            vec2 texel = 1.0 / u_resolution;
            float blurAmount = u_textureType == 2 ? 6.0 : 3.0;
            vec4 s1 = texture(u_image, v_uv - blurDir * texel * blurAmount);
            vec4 s2 = texture(u_image, v_uv + blurDir * texel * blurAmount);
            vec4 s3 = texture(u_image, v_uv - blurDir * texel * blurAmount * 0.5);
            vec4 s4 = texture(u_image, v_uv + blurDir * texel * blurAmount * 0.5);
            vec4 s0 = texture(u_image, v_uv);
            source = (s0 * 2.0 + s1 + s2 + s3 + s4) / 6.0;
          } else {
            source = texture(u_image, v_uv);
          }

          if (u_sharpness > 0.0) {
            vec2 texel = 1.0 / u_resolution;
            vec4 sUp    = texture(u_image, v_uv + vec2(0.0, texel.y));
            vec4 sDown  = texture(u_image, v_uv - vec2(0.0, texel.y));
            vec4 sLeft  = texture(u_image, v_uv - vec2(texel.x, 0.0));
            vec4 sRight = texture(u_image, v_uv + vec2(texel.x, 0.0));
            vec4 sharpened = source * 5.0 - sUp - sDown - sLeft - sRight;
            source = clamp(mix(source, sharpened, u_sharpness), 0.0, 1.0);
          }

          vec3 origRgb = texture(u_image, v_uv).rgb;
          float skinMask = u_preserveskin ? skinMembership(origRgb) : 0.0;

          float origR = origRgb.r * 255.0;
          float origG = origRgb.g * 255.0;
          float origB = origRgb.b * 255.0;
          vec2 origCbCr = vec2(
            128.0 - 0.168736 * origR - 0.331264 * origG + 0.5 * origB,
            128.0 + 0.5 * origR - 0.418688 * origG - 0.081312 * origB
          );

          float excludeW = 0.0;
          for (int i = 0; i < 8; i++) {
            if (i >= u_excludedCount) break;
            float d = length(origCbCr - u_excludedColors[i]);
            excludeW = max(excludeW, 1.0 - smoothstep(8.0, 18.0, d));
          }

          float includeW = 0.0;
          for (int i = 0; i < 8; i++) {
            if (i >= u_includedCount) break;
            float d = length(origCbCr - u_includedColors[i]);
            includeW = max(includeW, 1.0 - smoothstep(8.0, 18.0, d));
          }

          float protectMask = clamp(max(skinMask, excludeW) - includeW, 0.0, 1.0);

          float height = getHeightAt(v_uv, v_uv);
          vec3 normal = normalFromHeight(v_uv, v_uv);

          float ca = cos(u_lightazimuth);
          float sa = sin(u_lightazimuth);
          float ce = cos(u_lightelevation);
          float se = sin(u_lightelevation);
          vec3 lightDirection = normalize(vec3(ca * ce, sa * ce, se));

          vec3 lightColor = u_lighttint > 0.0
            ? mix(vec3(1.0), vec3(1.08, 0.95, 0.78), u_lighttint)
            : mix(vec3(1.0), vec3(0.82, 0.92, 1.08), -u_lighttint);

          float flatLambert = dot(vec3(0.0, 0.0, 1.0), lightDirection);
          float currentLambert = max(dot(normal, lightDirection), 0.0);

          float specular = 0.0;
          if (u_shininess > 0.0) {
            vec3 viewDir = vec3(0.0, 0.0, 1.0);
            vec3 halfDir = normalize(lightDirection + viewDir);
            float specAngle = max(dot(normal, halfDir), 0.0);
            specular = pow(specAngle, 36.0) * u_shininess * 1.5;
          }

          float lightDelta = currentLambert - flatLambert;
          float intensity = clamp(u_intensity, 0.0, 1.5);

          float lighting = clamp(0.5 + lightDelta * intensity * 1.5, 0.0, 1.0);
          float grooveShade = mix(1.0, 0.85 + 0.15 * height, intensity * 0.8);
          lighting *= grooveShade;

          float aoFactor = computeAO(v_uv, v_uv, height);
          aoFactor = mix(1.0, aoFactor, clamp(intensity, 0.0, 1.0));
          lighting *= aoFactor;

          vec3 blend = vec3(lighting) * lightColor;
          vec3 satColor = applySaturation(source.rgb, u_saturation);
          vec3 brightColor = applyBrightness(satColor, max(u_brightness, 0.01));
          vec3 baseColor = applyContrast(brightColor, max(u_contrast, 0.0));

          vec3 paper = paperColor(u_textureType);
          baseColor = mix(baseColor, baseColor * paper, u_paperTint);

          if (u_halftone > 0.0) {
              float dotSize = max(6.0, min(u_resolution.x, u_resolution.y) * 0.008);
              vec2 pixelPos = v_uv * u_resolution;
              float angleR = 15.0 * PI / 180.0;
              float angleG = 75.0 * PI / 180.0;
              float angleB = 0.0;
              
              mat2 rotR = mat2(cos(angleR), -sin(angleR), sin(angleR), cos(angleR));
              mat2 rotG = mat2(cos(angleG), -sin(angleG), sin(angleG), cos(angleG));
              mat2 rotB = mat2(cos(angleB), -sin(angleB), sin(angleB), cos(angleB));
              
              vec2 cellR = fract((rotR * pixelPos) / dotSize) - 0.5;
              vec2 cellG = fract((rotG * pixelPos) / dotSize) - 0.5;
              vec2 cellB = fract((rotB * pixelPos) / dotSize) - 0.5;
              
              float maxRadius = 0.707;
              float radiusR = maxRadius * sqrt(1.0 - baseColor.r);
              float radiusG = maxRadius * sqrt(1.0 - baseColor.g);
              float radiusB = maxRadius * sqrt(1.0 - baseColor.b);
              
              float aa = 1.0 / dotSize;
              float dotR = 1.0 - smoothstep(radiusR - aa, radiusR + aa, length(cellR));
              float dotG = 1.0 - smoothstep(radiusG - aa, radiusG + aa, length(cellG));
              float dotB = 1.0 - smoothstep(radiusB - aa, radiusB + aa, length(cellB));
              
              vec3 halfToneColor = clamp(vec3(1.0 - dotR, 1.0 - dotG, 1.0 - dotB), 0.0, 1.0);
              baseColor = mix(baseColor, halfToneColor, u_halftone * (1.0 - protectMask));
          }
          
          if (u_textureType == 4) {
              float luma = dot(baseColor, vec3(0.299, 0.587, 0.114));
              vec2 p = getBaseP(v_uv, v_uv);
              float n = fbm(p * 2.0);
              float thresh = 0.5 + (n - 0.5) * 0.2;
              float cut = step(thresh, luma);
              baseColor = mix(mix(vec3(0.1), vec3(0.9), cut), baseColor, protectMask);
          }

          if (u_textureType == 8) {
              vec3 hsv = rgb2hsv(baseColor);
              hsv.y = clamp(hsv.y * (1.0 + height * 0.45), 0.0, 1.0);
              hsv.z = clamp(hsv.z + (height - 0.5) * 0.08, 0.0, 1.0);
              baseColor = mix(hsv2rgb(hsv), baseColor, protectMask);
          }

          vec3 shaded;
          for(int i = 0; i < 3; i++) {
            if (baseColor[i] < 0.5) {
              shaded[i] = 2.0 * baseColor[i] * blend[i];
            } else {
              shaded[i] = 1.0 - 2.0 * (1.0 - baseColor[i]) * (1.0 - blend[i]);
            }
          }

          vec3 mixedShaded = mix(shaded, baseColor, protectMask);
          vec3 finalColor = clamp(mixedShaded + specular * lightColor * (1.0 - protectMask), 0.0, 1.0);

          if (u_vignette > 0.0) {
            vec2 vd = (v_uv - 0.5) * 2.0;
            float corner = length(vd);
            float vig = smoothstep(0.65, 1.3, corner) * u_vignette;
            finalColor = mix(finalColor, paper * 0.4, vig);
          }

          if (u_washintensity > 0.0) {
            vec3 final_hsv = rgb2hsv(finalColor);
            vec3 wash_hsv = rgb2hsv(u_washcolor);
            final_hsv.x = wash_hsv.x;
            final_hsv.y = wash_hsv.y;
            vec3 colored = hsv2rgb(final_hsv);
            finalColor = mix(finalColor, colored, u_washintensity * (1.0 - protectMask));
          }

          outColor = vec4(finalColor, source.a);
        }
      `;

      try {
        const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
        this.program = this.createProgram(vertexShader, fragmentShader);
      } catch (error) {
        this.setStatus(error.message, true);
        this.emit("filter-error", { message: error.message });
        return;
      }

      this.locations = {
        aPosition: gl.getAttribLocation(this.program, "a_position"),
        aUv: gl.getAttribLocation(this.program, "a_uv"),
        uImage: gl.getUniformLocation(this.program, "u_image"),
        uResolution: gl.getUniformLocation(this.program, "u_resolution"),
        uScale: gl.getUniformLocation(this.program, "u_scale"),
        uDepth: gl.getUniformLocation(this.program, "u_depth"),
        uAngle: gl.getUniformLocation(this.program, "u_angle"),
        uIntensity: gl.getUniformLocation(this.program, "u_intensity"),
        uSoften: gl.getUniformLocation(this.program, "u_soften"),
        uContrast: gl.getUniformLocation(this.program, "u_contrast"),
        uBrightness: gl.getUniformLocation(this.program, "u_brightness"),
        uWarp: gl.getUniformLocation(this.program, "u_warp"),
        uColorScale: gl.getUniformLocation(this.program, "u_colorscale"),
        uColorDepth: gl.getUniformLocation(this.program, "u_colordepth"),
        uShininess: gl.getUniformLocation(this.program, "u_shininess"),
        uLightAzimuth: gl.getUniformLocation(this.program, "u_lightazimuth"),
        uLightElevation: gl.getUniformLocation(this.program, "u_lightelevation"),
        uLightTint: gl.getUniformLocation(this.program, "u_lighttint"),
        uPaperTint: gl.getUniformLocation(this.program, "u_paperTint"),
        uAO: gl.getUniformLocation(this.program, "u_ao"),
        uVignette: gl.getUniformLocation(this.program, "u_vignette"),
        uDyeBleed: gl.getUniformLocation(this.program, "u_dyebleed"),
        uDistressed: gl.getUniformLocation(this.program, "u_distressed"),
        uPreserveSkin: gl.getUniformLocation(this.program, "u_preserveskin"),
        uExcludedCount: gl.getUniformLocation(this.program, "u_excludedCount"),
        uExcludedColors: gl.getUniformLocation(this.program, "u_excludedColors"),
        uIncludedCount: gl.getUniformLocation(this.program, "u_includedCount"),
        uIncludedColors: gl.getUniformLocation(this.program, "u_includedColors"),
        uHasImage: gl.getUniformLocation(this.program, "u_hasImage"),
        uTextureType: gl.getUniformLocation(this.program, "u_textureType"),
        uWashIntensity: gl.getUniformLocation(this.program, "u_washintensity"),
        uWashColor: gl.getUniformLocation(this.program, "u_washcolor"),
        uSharpness: gl.getUniformLocation(this.program, "u_sharpness"),
        uSaturation: gl.getUniformLocation(this.program, "u_saturation"),
        uHalftone: gl.getUniformLocation(this.program, "u_halftone")
      };

      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);

      const vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

      const quad = new Float32Array([
        -1, -1, 0, 0,
         1, -1, 1, 0,
        -1,  1, 0, 1,
        -1,  1, 0, 1,
         1, -1, 1, 0,
         1,  1, 1, 1
      ]);

      gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

      const stride = 4 * Float32Array.BYTES_PER_ELEMENT;

      gl.enableVertexAttribArray(this.locations.aPosition);
      gl.vertexAttribPointer(this.locations.aPosition, 2, gl.FLOAT, false, stride, 0);

      gl.enableVertexAttribArray(this.locations.aUv);
      gl.vertexAttribPointer(
        this.locations.aUv,
        2,
        gl.FLOAT,
        false,
        stride,
        2 * Float32Array.BYTES_PER_ELEMENT
      );

      gl.bindVertexArray(null);

      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([255, 255, 255, 0])
      );
    }

    setupResizeObserver() {
      if (this.resizeObserver) {
        return;
      }

      this.resizeObserver = new ResizeObserver(() => {
        this.resizeCanvasBackingStore();
        this.requestRender();
      });

      this.resizeObserver.observe(this);
    }

    createShader(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);

      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader) || "Unknown shader compile error.";
        gl.deleteShader(shader);
        throw new Error(info);
      }

      return shader;
    }

    createProgram(vertexShader, fragmentShader) {
      const gl = this.gl;
      const program = gl.createProgram();

      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program) || "Unknown shader program link error.";
        gl.deleteProgram(program);
        throw new Error(info);
      }

      return program;
    }

    handleFileChange(event) {
      const file = event.target.files && event.target.files[0];

      if (!file) {
        return;
      }

      if (!file.type || !file.type.startsWith("image/")) {
        this.setStatus("Please choose a valid image file.", true);
        this.emit("filter-error", { message: "Invalid image file." });
        return;
      }

      this.setStatus("Loading image…");
      this.downloadButton.disabled = true;

      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result !== "string") {
          this.setStatus("Could not read this image file.", true);
          return;
        }

        this.loadImageFromDataUrl(reader.result, file.name);
      };

      reader.onerror = () => {
        this.setStatus("Could not read this image file.", true);
        this.emit("filter-error", { message: "FileReader could not read the selected image." });
      };

      reader.readAsDataURL(file);
    }

    loadImageFromDataUrl(dataUrl, originalName = "image", skipSave = false) {
      const token = ++this.imageLoadToken;
      const image = new Image();

      image.onload = () => {
        if (token !== this.imageLoadToken) {
          return;
        }

        this.image = image;
        this.originalImage.src = dataUrl;
        this.originalFilename = originalName;
        this.setAttribute("data-has-image", "true");
        this.uploadImageTexture();
        this.resizeCanvasBackingStore();
        this.downloadButton.disabled = false;
        this.setStatus(`Loaded ${this.textureWidth} × ${this.textureHeight}px. Adjust sliders for live GPU preview.`);
        this.requestRender();

        this.emit("filter-ready", {
          width: this.textureWidth,
          height: this.textureHeight,
          filename: originalName
        });

        if (!skipSave) {
          this.saveImageToIndexedDB(dataUrl, originalName);
        }
      };

      image.onerror = () => {
        if (token !== this.imageLoadToken) {
          return;
        }

        this.setStatus("Could not decode this image.", true);
        this.emit("filter-error", { message: "Could not decode this image." });
      };

      image.src = dataUrl;
    }

    clearImage(skipSave = false) {
      this.image = null;
      if (this.originalImage) this.originalImage.src = "";
      this.textureSource = null;
      this.textureWidth = 1;
      this.textureHeight = 1;
      this.removeAttribute("data-has-image");

      if (this.downloadButton) {
        this.downloadButton.disabled = true;
      }

      if (this.gl && this.texture) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          1,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          new Uint8Array([255, 255, 255, 0])
        );
      }

      this.setStatus("Choose an image to begin.");
      this.resizeCanvasBackingStore();
      this.requestRender();

      if (!skipSave) {
        this.clearImageFromIndexedDB();
      }
    }

    uploadImageTexture() {
      if (!this.gl || !this.image) {
        return;
      }

      const gl = this.gl;
      this.textureSource = this.makeTextureSource(this.image);
      this.textureWidth = this.textureSource.width || this.textureSource.naturalWidth || 1;
      this.textureHeight = this.textureSource.height || this.textureSource.naturalHeight || 1;

      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.textureSource);
    }

    makeTextureSource(image) {
      const width = image.naturalWidth || image.width || 1;
      const height = image.naturalHeight || image.height || 1;
      const scale = Math.min(1, this.maxTextureSize / Math.max(width, height));

      if (scale >= 1) {
        return image;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));

      const context = canvas.getContext("2d", {
        alpha: true,
        willReadFrequently: false
      });

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      return canvas;
    }

    resizeCanvasBackingStore() {
      if (!this.canvas) {
        return;
      }

      let targetWidth;
      let targetHeight;

      if (this.image && this.textureWidth > 1 && this.textureHeight > 1) {
        targetWidth = this.textureWidth;
        targetHeight = this.textureHeight;
      } else {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        targetWidth = Math.max(1, Math.round((rect.width || 960) * dpr));
        targetHeight = Math.max(1, Math.round((rect.height || 540) * dpr));
      }

      if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
        this.canvas.width = targetWidth;
        this.canvas.height = targetHeight;
      }
    }

    setParamFromAttribute(name, rawValue) {
      const config = this.controlConfig[name];

      if (!config) {
        return;
      }

      if (config.type === "color") {
        this.params[name] = rawValue || config.value;
        return;
      }

      const numeric = Number(rawValue);
      const value = Number.isFinite(numeric) ? numeric : config.value;
      this.params[name] = Math.min(config.max, Math.max(config.min, value));
    }

    syncControl(name) {
      if (!this.inputs || !this.numInputs) {
        return;
      }

      const input = this.inputs[name];
      const numInput = this.numInputs[name];
      const config = this.controlConfig[name];
      const value = this.params[name];

      if (input) {
        if (input.type === "checkbox") {
          input.checked = !!value;
        } else {
          input.value = String(value);
        }
      }

      if (numInput && this.shadowRoot.activeElement !== numInput) {
        numInput.value = this.formatNumber(value, config);
      }
    }

    formatNumber(value, config) {
      const step = Number(config.step);
      const decimals = step > 0 && step < 1 ? String(step).split(".")[1].length : 0;
      return Number(value).toFixed(decimals);
    }

    resetControls() {
      Object.entries(this.controlConfig).forEach(([name, config]) => {
        this.setAttribute(name, String(config.value));
      });

      this.setStatus(this.image ? "Controls reset." : "Choose an image to begin.");
    }

    saveRecentSettings() {
      const currentState = {};
      Object.keys(this.controlConfig).forEach(key => {
        currentState[key] = this.params[key];
      });
      try {
        localStorage.setItem("canvas-filter-recent-settings", JSON.stringify(currentState));
      } catch (e) {
        console.warn("Failed to save recent settings", e);
      }
    }

    loadRecentSettings() {
      try {
        const stored = localStorage.getItem("canvas-filter-recent-settings");
        if (stored) {
          const config = JSON.parse(stored);
          Object.keys(this.controlConfig).forEach(key => {
            if (config[key] !== undefined) {
              this.setAttribute(key, config[key]);
            }
          });
        }
      } catch (e) {
        console.warn("Failed to load recent settings", e);
      }
    }

    initIndexedDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open("CanvasFilterDB", 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("images")) {
            db.createObjectStore("images");
          }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
      });
    }

    async saveImageToIndexedDB(dataUrl, filename) {
      try {
        const db = await this.initIndexedDB();
        const tx = db.transaction("images", "readwrite");
        const store = tx.objectStore("images");
        store.put({ dataUrl, filename }, "recentImage");
      } catch (e) {
        console.warn("Failed to save image to IndexedDB", e);
      }
    }

    async loadRecentImage() {
      try {
        const db = await this.initIndexedDB();
        const tx = db.transaction("images", "readonly");
        const store = tx.objectStore("images");
        const request = store.get("recentImage");
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.dataUrl) {
            this.loadImageFromDataUrl(result.dataUrl, result.filename, true);
          }
        };
      } catch (e) {
        console.warn("Failed to load image from IndexedDB", e);
      }
    }

    async clearImageFromIndexedDB() {
      try {
        const db = await this.initIndexedDB();
        const tx = db.transaction("images", "readwrite");
        const store = tx.objectStore("images");
        store.delete("recentImage");
      } catch (e) {
        console.warn("Failed to clear image from IndexedDB", e);
      }
    }

    requestRender() {
      if (this.animationFrame) {
        return;
      }

      this.animationFrame = requestAnimationFrame(() => {
        this.animationFrame = 0;
        this.renderCanvas();
      });
    }

    renderCanvas() {
      const gl = this.gl;

      if (!gl || !this.program || !this.vao || !this.canvas) {
        return;
      }

      this.resizeCanvasBackingStore();

      const width = this.canvas.width;
      const height = this.canvas.height;

      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(this.program);
      gl.bindVertexArray(this.vao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);

      gl.uniform1i(this.locations.uImage, 0);
      gl.uniform2f(this.locations.uResolution, width, height);
      gl.uniform1f(this.locations.uScale, this.params.scale);
      gl.uniform1f(this.locations.uDepth, this.params.depth);
      gl.uniform1f(this.locations.uAngle, this.params.angle * Math.PI / 180);
      gl.uniform1f(this.locations.uIntensity, this.params.intensity);
      gl.uniform1f(this.locations.uSoften, this.params.soften);
      gl.uniform1f(this.locations.uContrast, this.params.contrast);
      gl.uniform1f(this.locations.uBrightness, this.params.brightness);
      gl.uniform1f(this.locations.uWarp, this.params.warp);
      gl.uniform1f(this.locations.uColorScale, this.params.colorscale);
      gl.uniform1f(this.locations.uColorDepth, this.params.colordepth);
      gl.uniform1f(this.locations.uShininess, this.params.shininess);
      gl.uniform1f(this.locations.uLightAzimuth, this.params.lightazimuth * Math.PI / 180);
      gl.uniform1f(this.locations.uLightElevation, this.params.lightelevation * Math.PI / 180);
      gl.uniform1f(this.locations.uLightTint, this.params.lighttint);
      gl.uniform1f(this.locations.uPaperTint, this.params.papertint);
      gl.uniform1f(this.locations.uAO, this.params.ao);
      gl.uniform1f(this.locations.uVignette, this.params.vignette);
      gl.uniform1i(this.locations.uDyeBleed, this.params.dyebleed ? 1 : 0);
      gl.uniform1i(this.locations.uDistressed, this.params.distressed ? 1 : 0);
      gl.uniform1i(this.locations.uPreserveSkin, this.params.preserveskin ? 1 : 0);

      const exCount = Math.min(this.excludedColors.length, 8);
      const exArr = new Float32Array(16);
      for (let i = 0; i < exCount; i++) {
        exArr[i * 2] = this.excludedColors[i].cb;
        exArr[i * 2 + 1] = this.excludedColors[i].cr;
      }
      gl.uniform1i(this.locations.uExcludedCount, exCount);
      gl.uniform2fv(this.locations.uExcludedColors, exArr);

      const inCount = Math.min(this.includedColors.length, 8);
      const inArr = new Float32Array(16);
      for (let i = 0; i < inCount; i++) {
        inArr[i * 2] = this.includedColors[i].cb;
        inArr[i * 2 + 1] = this.includedColors[i].cr;
      }
      gl.uniform1i(this.locations.uIncludedCount, inCount);
      gl.uniform2fv(this.locations.uIncludedColors, inArr);

      gl.uniform1i(this.locations.uHasImage, this.image ? 1 : 0);
      gl.uniform1i(this.locations.uTextureType, this.params.texturetype);

      gl.uniform1f(this.locations.uWashIntensity, this.params.washintensity);
      const hex = this.params.washcolor;
      if (hex && hex.length === 7) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        gl.uniform3f(this.locations.uWashColor, r, g, b);
      } else {
        gl.uniform3f(this.locations.uWashColor, 0, 0, 0);
      }

      gl.uniform1f(this.locations.uSharpness, this.params.sharpness);
      gl.uniform1f(this.locations.uSaturation, this.params.saturation);
      gl.uniform1f(this.locations.uHalftone, this.params.halftone);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);
    }

    download(filename) {
      if (!this.gl || !this.image) {
        this.setStatus("Upload an image before downloading.", true);
        this.emit("filter-error", { message: "No image is loaded." });
        return;
      }

      this.renderCanvas();
      this.gl.finish();

      let dataUrl;

      try {
        dataUrl = this.canvas.toDataURL("image/png");
      } catch (error) {
        this.setStatus("Could not export the canvas.", true);
        this.emit("filter-error", { message: error.message });
        return;
      }

      const outputName = filename || this.makeDownloadFilename();
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = outputName;
      link.rel = "noopener";
      link.style.display = "none";

      this.shadowRoot.appendChild(link);
      link.click();
      link.remove();

      this.setStatus(`Downloaded ${outputName}.`);
      this.emit("download-ready", {
        filename: outputName,
        width: this.canvas.width,
        height: this.canvas.height
      });
    }

    makeDownloadFilename() {
      const base = (this.originalFilename || "image")
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-z0-9_-]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "image";

      const stamp = new Date()
        .toISOString()
        .replace(/\.\d{3}Z$/, "")
        .replace(/[:T]/g, "-");

      return `${base}-texturized-${stamp}.png`;
    }

    setStatus(message, isError = false) {
      if (!this.statusEl) {
        return;
      }

      this.statusEl.textContent = message;
      this.statusEl.style.color = isError ? "#b91c1c" : "#64748b";
    }

    emit(type, detail) {
      this.dispatchEvent(new CustomEvent(type, {
        detail,
        bubbles: true,
        composed: true
      }));
    }
  }

  customElements.define(TAG_NAME, CanvasFilterElement);
})();