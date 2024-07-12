import { readFileSync, writeFileSync } from 'fs'
import * as path from 'path'
import { afterCreateHook } from '../hook'

const PROJECT_NAME = new RegExp(/%%PROJECT_NAME.*%%/g)

afterCreateHook.addHook(
  ['cloudflare-workers', 'cloudflare-pages', 'x-basic'],
  ({ projectName, directoryPath }) => {
    const wranglerPath = path.join(directoryPath, 'wrangler.toml')
    const wrangler = readFileSync(wranglerPath, 'utf-8')
    const convertProjectName = projectName
      .toLowerCase()
      .replaceAll(/[^a-z0-9\-_]/gm, '-')
    const rewritten = wrangler.replaceAll(PROJECT_NAME, convertProjectName)
    writeFileSync(wranglerPath, rewritten)
  },
)

const regex = /compatibility_date\s*=\s*"\d{4}-\d{2}-\d{2}"/
afterCreateHook.addHook(['cloudflare-workers'], ({ directoryPath }) => {
  const wranglerPath = path.join(directoryPath, 'wrangler.toml')
  const wrangler = readFileSync(wranglerPath, 'utf-8')

  const currentDate = new Date().toISOString().split('T')[0] // Get current date in YYYY-MM-DD format

  const rewritten = wrangler.replace(
    regex,
    `compatibility_date = "${currentDate}"`,
  )

  writeFileSync(wranglerPath, rewritten)
})

export { afterCreateHook }
