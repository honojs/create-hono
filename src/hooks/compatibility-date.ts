import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as path from 'node:path'

// wrangler.* for templates that use wrangler, cloudflare.config.ts for the cf CLI
export const CONFIG_FILES = [
  'wrangler.toml',
  'wrangler.json',
  'wrangler.jsonc',
  'cloudflare.config.ts',
]

const COMPATIBILITY_DATE_TOML = /compatibility_date\s*=\s*"\d{4}-\d{2}-\d{2}"/
const COMPATIBILITY_DATE_JSON = /"compatibility_date"\s*:\s*"\d{4}-\d{2}-\d{2}"/
const COMPATIBILITY_DATE_TS =
  /compatibilityDate\s*:\s*['"]\d{4}-\d{2}-\d{2}['"]/

/**
 * The release date of the installed workerd, from its version
 * (1.20261019.1 is 2026-10-19). workerd rejects a compatibility date
 * later than its release date plus 7 days, so today's date fails when
 * the installed workerd is older. With several workerd versions, the
 * oldest wins.
 */
export const getWorkerdDate = (directoryPath: string): string | undefined => {
  const modules = path.join(directoryPath, 'node_modules')
  const versions: string[] = []
  // npm, yarn, and bun hoist it
  try {
    const packageJson = readFileSync(
      path.join(modules, 'workerd', 'package.json'),
      'utf-8',
    )
    versions.push(JSON.parse(packageJson).version)
  } catch {}
  // pnpm and deno keep it in a store, like `workerd@1.20261019.1`
  for (const store of ['.pnpm', '.deno']) {
    try {
      for (const name of readdirSync(path.join(modules, store))) {
        const version = name.match(/^workerd@(.+)$/)?.[1]
        if (version) {
          versions.push(version)
        }
      }
    } catch {}
  }
  return versions
    .map((version) => version.match(/^\d+\.(\d{4})(\d{2})(\d{2})/))
    .filter((match) => match !== null)
    .map(([, year, month, day]) => `${year}-${month}-${day}`)
    .sort()[0]
}

/**
 * Set the compatibility date in the Cloudflare config files to the
 * release date of the installed workerd. Without workerd, the date of
 * the template stays.
 */
export const setCompatibilityDate = (directoryPath: string) => {
  const date = getWorkerdDate(directoryPath)
  if (!date) {
    return
  }
  for (const filename of CONFIG_FILES) {
    try {
      const configPath = path.join(directoryPath, filename)
      const config = readFileSync(configPath, 'utf-8')
      const rewritten = config
        .replace(COMPATIBILITY_DATE_TOML, `compatibility_date = "${date}"`)
        .replace(COMPATIBILITY_DATE_JSON, `"compatibility_date": "${date}"`)
        .replace(COMPATIBILITY_DATE_TS, `compatibilityDate: '${date}'`)
      writeFileSync(configPath, rewritten)
    } catch {}
  }
}
