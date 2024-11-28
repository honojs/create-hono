import { readFileSync, writeFileSync } from 'node:fs'
import * as path from 'node:path'
import { afterCreateHook } from '../hook'

const PROJECT_NAME = new RegExp(/%%PROJECT_NAME.*%%/g)
const PACKAGE_MANAGER = new RegExp(/\$npm_execpath/g)

afterCreateHook.addHook(
  ['cloudflare-workers', 'cloudflare-pages', 'x-basic'],
  ({ projectName, packageManager, directoryPath }) => {
    // Read the wrangler.toml file
    const wranglerPath = path.join(directoryPath, 'wrangler.toml')
    const wrangler = readFileSync(wranglerPath, 'utf-8')
    const convertProjectName = projectName
      .toLowerCase()
      .replaceAll(/[^a-z0-9\-_]/gm, '-')
    const rewrittenWranglerFile = wrangler.replaceAll(
      PROJECT_NAME,
      convertProjectName,
    )
    writeFileSync(wranglerPath, rewrittenWranglerFile)

    // Read the package.json file
    const packageJsonPath = path.join(directoryPath, 'package.json')
    const packageJson = readFileSync(packageJsonPath, 'utf-8')
    const rewrittenPackageJsonFile = packageJson.replaceAll(
      PACKAGE_MANAGER,
      packageManager,
    )
    writeFileSync(packageJsonPath, rewrittenPackageJsonFile)
  },
)

const COMPATIBILITY_DATE = /compatibility_date\s*=\s*"\d{4}-\d{2}-\d{2}"/
afterCreateHook.addHook(
  ['cloudflare-workers', 'cloudflare-pages'],
  ({ directoryPath }) => {
    const wranglerPath = path.join(directoryPath, 'wrangler.toml')
    const wrangler = readFileSync(wranglerPath, 'utf-8')
    // Get current date in YYYY-MM-DD format
    const currentDate = new Date().toISOString().split('T')[0]
    const rewritten = wrangler.replace(
      COMPATIBILITY_DATE,
      `compatibility_date = "${currentDate}"`,
    )
    writeFileSync(wranglerPath, rewritten)
  },
)

export { afterCreateHook }
