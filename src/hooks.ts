import { readFileSync, writeFileSync } from 'fs'
import path from 'path'

type Hook = (args: { projectName: string; directoryPath: string }) => void

// <templateName, Hook[]>
export const ON_CREATE_HOOKS = new Map<string, Hook[]>()

const addOnCreateHook = (templateName: string, hook: Hook) => {
  const hooks = ON_CREATE_HOOKS.get(templateName) || []
  hooks.push(hook)
  ON_CREATE_HOOKS.set(templateName, hooks)
}
