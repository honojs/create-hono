import { readFileSync, writeFileSync } from 'fs'
import * as path from 'path'
import { Hook } from '../hook'

type AfterHookOptions = {
  projectName: string
  directoryPath: string
}

type AfterHookFunction = (options: AfterHookOptions) => void

const afterCreateHook = new Hook<AfterHookFunction>()

afterCreateHook.addHook(
  'cloudflare-workers',
  ({ projectName, directoryPath }) => {
    const wranglerPath = path.join(directoryPath, 'wrangler.toml')
    const wrangler = readFileSync(wranglerPath, 'utf-8')
    const rewritten = wrangler.replaceAll('%%PROJECT_NAME%%', projectName)
    writeFileSync(wranglerPath, rewritten)
  }
)

export { afterCreateHook }
