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
compatibility_date = "2023-12-01"

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

        const firstHookContent = `
name = "test-projectname-123"
compatibility_date = "2023-12-01"

[env.staging]
name = "test-projectname-123-staging"
    `.trim()

        // Get current date in YYYY-MM-DD format
        const currentDate = new Date().toISOString().split('T')[0]
        const secondHookContent = `
name = "%%PROJECT_NAME%%"
compatibility_date = "${currentDate}"

[env.staging]
name = "%%PROJECT_NAME%%-staging"
    `.trim()

        afterCreateHook.applyHook('cloudflare-workers', {
          projectName,
          directoryPath,
        })
        expect(readFileSync).toHaveBeenCalledWith(wranglerPath, 'utf-8')
        expect(writeFileSync).nthCalledWith(1, wranglerPath, firstHookContent)
        expect(writeFileSync).nthCalledWith(2, wranglerPath, secondHookContent)
      })
    })
  })
})
