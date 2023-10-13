import * as path from 'path'
import { describe, expect, it, vi } from 'vitest'
import {
  AFTER_CREATE,
  addAfterCreateHook,
  rewriteWranglerHook,
} from './after-create'

describe('addAfterCreateHook', () => {
  it('adds a hook to the AFTER_CREATE map', () => {
    const hook = () => {}
    addAfterCreateHook('test-template', hook)
    expect(AFTER_CREATE.get('test-template')).toEqual([hook])
  })
})

describe('rewriteWranglerHook', () => {
  it('rewrites the wrangler.toml file with the project name', async () => {
    vi.mock('fs', () => {
      const wrangler = `
name = "%%PROJECT_NAME%%"
type = "javascript"
account_id = "test-account-id"
workers_dev = true
route = ""
zone_id = ""
      `.trim()

      return {
        readFileSync: vi.fn().mockReturnValue(wrangler),
        writeFileSync: vi.fn(),
      }
    })
    const { readFileSync, writeFileSync } = await import('fs')

    const projectName = 'test-project'
    const directoryPath = './tmp'
    const wranglerPath = path.join(directoryPath, 'wrangler.toml')
    const replaced = `
name = "${projectName}"
type = "javascript"
account_id = "test-account-id"
workers_dev = true
route = ""
zone_id = ""
    `.trim()
    rewriteWranglerHook({ projectName, directoryPath })
    expect(readFileSync).toHaveBeenCalledWith(wranglerPath, 'utf-8')
    expect(writeFileSync).toHaveBeenCalledWith(wranglerPath, replaced)
  })
})
