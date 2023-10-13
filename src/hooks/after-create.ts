import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { Hook } from './types'

// <templateName, Hook[]>src/hooks/on-create.ts
export const AFTER_CREATE = new Map<string, Hook[]>()

export const addOnCreateHook = (templateName: string, hook: Hook) => {
  const hooks = AFTER_CREATE.get(templateName) || []
  hooks.push(hook)
  AFTER_CREATE.set(templateName, hooks)
}

const PROJECT_NAME_REPLACE_KEY = '[DYNAMIC_PROJECT_NAME]'

const rewriteWranglerHook: Hook = ({ projectName, directoryPath }) => {
  const wranglerPath = path.join(directoryPath, 'wrangler.toml')
  const wrangler = readFileSync(wranglerPath, 'utf-8')
  const rewritten = wrangler.replace(PROJECT_NAME_REPLACE_KEY, projectName)
  writeFileSync(wranglerPath, rewritten)
}

addOnCreateHook('cloudflare-workers', rewriteWranglerHook)
