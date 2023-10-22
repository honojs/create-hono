import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { afterCreateHook } from './after-create'

describe('afterCreateHook', () => {
  describe('cloudflare-workers', () => {
    describe('rewriteWranglerHook', () => {
      it('rewrites the wrangler.toml file with the project name', async () => {
        vi.mock('fs', () => {
          const wrangler = `
name = "%%PROJECT_NAME%%"

[env.staging]
name = "%%PROJECT_NAME%%-staging"
      `.trim()

          return {
            readFileSync: vi.fn().mockReturnValue(wrangler),
            writeFileSync: vi.fn(),
          }
        })
        const { readFileSync, writeFileSync } = await import('fs')

        const projectName = 'test-projectNAME+123'
        const directoryPath = './tmp'
        const wranglerPath = join(directoryPath, 'wrangler.toml')
        const replaced = `
name = "test-projectname-123"

[env.staging]
name = "test-projectname-123-staging"
    `.trim()
        afterCreateHook.applyHook('cloudflare-workers', {
          projectName,
          directoryPath,
        })
        expect(readFileSync).toHaveBeenCalledWith(wranglerPath, 'utf-8')
        expect(writeFileSync).toHaveBeenCalledWith(wranglerPath, replaced)
      })
    })
  })
})
