import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'

// Resolve the short commit SHA at build time so the deployed app can show which
// build is live. Works locally and in CI (checkout includes .git); falls back to
// GITHUB_SHA, then "dev".
function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return (process.env.GITHUB_SHA ?? 'dev').slice(0, 7)
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(gitSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
