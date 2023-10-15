import { readFileSync, writeFileSync } from 'fs'
import * as path from 'path'
import { afterCreateHook } from '../hook'

const PROJECT_NAME = new RegExp(/%%PROJECT_NAME.*%%/g)

afterCreateHook.addHook(
  'cloudflare-workers',
  ({ projectName, directoryPath }) => {
    const wranglerPath = path.join(directoryPath, 'wrangler.toml')
    const wrangler = readFileSync(wranglerPath, 'utf-8')
    const rewritten = wrangler.replaceAll(PROJECT_NAME, projectName)
    writeFileSync(wranglerPath, rewritten)
  }
)

export { afterCreateHook }
