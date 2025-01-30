import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { afterCreateHook } from './after-create'

describe('afterCreateHook', () => {
  describe('cloudflare-workers', () => {
    describe('rewriteWranglerHook', async () => {
      vi.mock('fs', () => {
        const directoryPath = './tmp'
        const mockFiles: Record<string, string> = {
          [join(directoryPath, 'wrangler.toml')]: `
name = "%%PROJECT_NAME%%"
compatibility_date = "2023-12-01"

[env.staging]
name = "%%PROJECT_NAME%%-staging"`.trim(),
          [join(directoryPath, 'wrangler.json')]: `
"name": "%%PROJECT_NAME%%",
"compatibility_date": "2023-12-01",
"env": {
  "staging": {
  "name": "%%PROJECT_NAME%%-staging"
}`.trim(),
        }

        return {
          readFileSync: vi.fn((path: string) => {
            if (mockFiles[path]) {
              return mockFiles[path]
            }
          }),
          writeFileSync: vi.fn(),
        }
      })

      const { readFileSync, writeFileSync } = await import('node:fs')

      const projectName = 'test-projectNAME+123'
      const directoryPath = './tmp'
      const packageManager = 'npm'

      it('rewrites the wrangler.toml file with the project name', async () => {
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

        const wranglerPath = join(directoryPath, 'wrangler.toml')

        afterCreateHook.applyHook('cloudflare-workers', {
          projectName,
          directoryPath,
          packageManager,
        })
        expect(readFileSync).toHaveBeenCalledWith(wranglerPath, 'utf-8')

        expect(writeFileSync).nthCalledWith(1, wranglerPath, firstHookContent)
        expect(writeFileSync).nthCalledWith(3, wranglerPath, secondHookContent)
      })

      it('rewrites the wrangler.json file with the project name', async () => {
        const firstHookContent = `
"name": "test-projectname-123",
"compatibility_date": "2023-12-01",
"env": {
  "staging": {
  "name": "test-projectname-123-staging"
}`.trim()

        // Get current date in YYYY-MM-DD format
        const currentDate = new Date().toISOString().split('T')[0]
        const secondHookContent = `
"name": "%%PROJECT_NAME%%",
"compatibility_date": "${currentDate}",
"env": {
  "staging": {
  "name": "%%PROJECT_NAME%%-staging"
}`.trim()

        const wranglerPath = join(directoryPath, 'wrangler.json')

        afterCreateHook.applyHook('cloudflare-workers', {
          projectName,
          directoryPath,
          packageManager,
        })
        expect(readFileSync).toHaveBeenCalledWith(wranglerPath, 'utf-8')
        expect(writeFileSync).nthCalledWith(2, wranglerPath, firstHookContent)
        expect(writeFileSync).nthCalledWith(4, wranglerPath, secondHookContent)
      })
    })
  })
})
