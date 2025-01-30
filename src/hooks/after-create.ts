import { readFileSync, writeFileSync } from 'node:fs'
import * as path from 'node:path'
import { afterCreateHook } from '../hook'

const PROJECT_NAME = new RegExp(/%%PROJECT_NAME.*%%/g)

const WRANGLER_FILES = ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc']

afterCreateHook.addHook(
  ['cloudflare-workers', 'cloudflare-pages', 'x-basic'],
  ({ projectName, directoryPath }) => {
    for (const filename of WRANGLER_FILES) {
      try {
        const wranglerPath = path.join(directoryPath, filename)
        const wrangler = readFileSync(wranglerPath, 'utf-8')
        const convertProjectName = projectName
          .toLowerCase()
          .replaceAll(/[^a-z0-9\-_]/gm, '-')
        const rewritten = wrangler.replaceAll(PROJECT_NAME, convertProjectName)
        writeFileSync(wranglerPath, rewritten)
      } catch {}
    }
  },
)

const PACKAGE_MANAGER = new RegExp(/\$npm_execpath/g)

afterCreateHook.addHook(
  ['cloudflare-pages', 'x-basic'],
  ({ packageManager, directoryPath }) => {
    const packageJsonPath = path.join(directoryPath, 'package.json')
    const packageJson = readFileSync(packageJsonPath, 'utf-8')
    const rewritten = packageJson.replaceAll(PACKAGE_MANAGER, packageManager)
    writeFileSync(packageJsonPath, rewritten)
  },
)

const COMPATIBILITY_DATE_TOML = /compatibility_date\s*=\s*"\d{4}-\d{2}-\d{2}"/
const COMPATIBILITY_DATE_JSON = /"compatibility_date"\s*:\s*"\d{4}-\d{2}-\d{2}"/
afterCreateHook.addHook(
  ['cloudflare-workers', 'cloudflare-pages', 'x-basic'],
  ({ directoryPath }) => {
    for (const filename of WRANGLER_FILES) {
      try {
        const wranglerPath = path.join(directoryPath, filename)
        const wrangler = readFileSync(wranglerPath, 'utf-8')
        // Get current date in YYYY-MM-DD format
        const currentDate = new Date().toISOString().split('T')[0]
        const rewritten = wrangler
          .replace(
            COMPATIBILITY_DATE_TOML,
            `compatibility_date = "${currentDate}"`,
          )
          .replace(
            COMPATIBILITY_DATE_JSON,
            `"compatibility_date": "${currentDate}"`,
          )
        writeFileSync(wranglerPath, rewritten)
      } catch {}
    }
  },
)

export { afterCreateHook }
