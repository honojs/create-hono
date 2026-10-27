import { readFileSync, writeFileSync } from 'node:fs'
import * as path from 'node:path'
import { afterCreateHook } from '../hook'
import { CONFIG_FILES } from './compatibility-date'

const PROJECT_NAME = new RegExp(/%%PROJECT_NAME.*%%/g)

afterCreateHook.addHook(
  ['cloudflare-workers', 'x-basic'],
  ({ projectName, directoryPath }) => {
    for (const filename of CONFIG_FILES) {
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

afterCreateHook.addHook(['x-basic'], ({ packageManager, directoryPath }) => {
  const packageJsonPath = path.join(directoryPath, 'package.json')
  const packageJson = readFileSync(packageJsonPath, 'utf-8')
  const rewritten = packageJson.replaceAll(PACKAGE_MANAGER, packageManager)
  writeFileSync(packageJsonPath, rewritten)
})

export { afterCreateHook }
