// Runs one page in headless Chrome (software WebGL) and collects what it
// reports. Shared by the checks that need more than check-browser.mjs's
// single page: check-pixels.mjs and compare-samples.mjs.
//
// The page talks back with POST /log: { save, dataUrl } writes a picture
// into `outDir`, { error } fails the run, { done, results } ends it.

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const known = [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ];
  for (const path of known) {
    if (existsSync(path)) return path;
  }
  const cache = join(homedir(), ".cache", "ms-playwright");
  if (existsSync(cache)) {
    for (const dir of readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      for (const sub of readdirSync(join(cache, dir))) {
        const path = join(cache, dir, sub, "chrome");
        if (existsSync(path)) return path;
      }
    }
  }
  throw new Error("No Chrome found. Set CHROME to its path.");
}

// A file as it was at a commit, for comparing against an older renderer.
export function gitShow(commit, path) {
  return execFileSync("git", ["show", `${commit}:${path}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
}

const TYPES = { ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png" };
const typeOf = (path) => TYPES[path.slice(path.lastIndexOf(".")).toLowerCase()] || "application/octet-stream";

// routes: { "/path": () => Buffer } served beside the page and /src/*.js.
// gpu: true uses the machine's real graphics instead of software rendering,
// for timings; the checks keep software rendering so they run anywhere.
export function runPage({ script, routes = {}, outDir = null, timeoutMs = 600_000, args = [], gpu = false }) {
  const page = `<!doctype html><meta charset="utf-8"><title>texturizer check</title>
<style>body { margin: 0; } texturize-filter, texturize-filter-base { display: block; width: 900px; }</style>
<script>
const report = (error) => fetch("/log", { method: "POST", body: JSON.stringify({ error: String(error) }) });
addEventListener("error", (e) => report((e.error && e.error.stack) || e.message
  || (e.target && e.target.tagName ? "error at " + e.target.outerHTML.slice(0, 200) : e)), true);
addEventListener("unhandledrejection", (e) => report((e.reason && e.reason.stack) || e.reason));
</script>
<script type="module">
${script}
</script>`;

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
      const send = (body, type) => res.writeHead(200, { "content-type": type, "cache-control": "no-store" }).end(body);
      if (req.method === "GET" && url.pathname === "/") {
        send(page, "text/html");
      } else if (req.method === "GET" && routes[url.pathname]) {
        try {
          send(routes[url.pathname](), typeOf(url.pathname));
        } catch (e) {
          res.writeHead(500).end();
          finish(e);
        }
      } else if (req.method === "GET" && /^\/src\/[a-z-]+\.js$/.test(url.pathname)) {
        send(readFileSync(join(ROOT, url.pathname.slice(1))), "text/javascript");
      } else if (req.method === "POST" && url.pathname === "/log") {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          res.writeHead(204).end();
          const message = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (message.save && outDir) {
            mkdirSync(outDir, { recursive: true });
            const base64 = message.dataUrl.slice(message.dataUrl.indexOf(",") + 1);
            writeFileSync(join(outDir, message.save), Buffer.from(base64, "base64"));
          } else if (message.progress) {
            console.log(message.progress);
          } else if (message.error) {
            finish(new Error(message.error));
          } else if (message.done) {
            finish(null, message.results);
          }
        });
      } else {
        if (url.pathname !== "/favicon.ico") console.log(`404 ${req.method} ${url.pathname}`);
        res.writeHead(404).end();
      }
    });

    server.listen(0, "127.0.0.1", () => {
      chrome = spawn(findChrome(), [
        "--headless=new",
        ...(gpu ? [] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]),
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${mkdtempSync(join(tmpdir(), "tx-"))}`,
        ...args,
        `http://127.0.0.1:${server.address().port}/`
      ], { stdio: "ignore" });
      chrome.on("error", (e) => finish(e));
      timer = setTimeout(() => finish(new Error(`Timed out after ${timeoutMs / 1000} s.`)), timeoutMs);
    });
  });
}

export function report(results) {
  let failed = 0;
  for (const { name, ok, detail } of results) {
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  }
  console.log(`\n${results.length - failed} of ${results.length} passed.`);
  return failed;
}
