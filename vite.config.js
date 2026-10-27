import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

// The version's third number: how many commits since the VERSION line in src/version.js last
// changed (so 0.19 → 0.19.0, 0.19.1, …). Needs the full git history (the deploy fetches it).
function buildNumber() {
  try {
    const git = cmd => execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    const changed = git('log -1 --format=%H -G"^export const VERSION" -- src/version.js')
    return changed ? git(`rev-list --count ${changed}..HEAD`) : '0'
  } catch (e) {
    return '0'
  }
}

export default defineConfig(({ command }) => ({
  base: './',   // works at any path (GitHub Pages serves the game from /gourd-wars/)
  define: {
    // the dev server is marked, so a local copy never matches the live game by accident
    __BUILD_NUMBER__: JSON.stringify(buildNumber() + (command === 'serve' ? '-dev' : '')),
  },
  test: {
    include: ['tests/**/*.test.js'],
  },
}))
