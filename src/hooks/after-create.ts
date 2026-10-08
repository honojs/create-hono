import { readFileSync, writeFileSync } from 'node:fs'
import * as path from 'node:path'
import { afterCreateHook } from '../hook'

const PROJECT_NAME = new RegExp(/%%PROJECT_NAME.*%%/g)

const WRANGLER_FILES = ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc']

afterCreateHook.addHook(
  [
    'cloudflare-workers',
    'cloudflare-workers+vite',
    'cloudflare-pages',
    'x-basic',
  ],
  ({ projectName, directoryPath }) => {
    for (const filename of WRANGLER_FILES) {
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

afterCreateHook.addHook(
  ['cloudflare-pages', 'x-basic'],
  ({ packageManager, directoryPath }) => {
    const packageJsonPath = path.join(directoryPath, 'package.json')
    const packageJson = readFileSync(packageJsonPath, 'utf-8')
    const rewritten = packageJson.replaceAll(PACKAGE_MANAGER, packageManager)
    writeFileSync(packageJsonPath, rewritten)
  },
)

const COMPATIBILITY_DATE_TOML = /compatibility_date\s*=\s*"\d{4}-\d{2}-\d{2}"/
const COMPATIBILITY_DATE_JSON = /"compatibility_date"\s*:\s*"\d{4}-\d{2}-\d{2}"/
afterCreateHook.addHook(
  ['cloudflare-workers', 'cloudflare-pages', 'x-basic'],
  ({ directoryPath }) => {
    for (const filename of WRANGLER_FILES) {
      try {
        const wranglerPath = path.join(directoryPath, filename)
        const wrangler = readFileSync(wranglerPath, 'utf-8')
        // Get current date in YYYY-MM-DD format
        const currentDate = new Date().toISOString().split('T')[0]
        const rewritten = wrangler
          .replace(
            COMPATIBILITY_DATE_TOML,
            `compatibility_date = "${currentDate}"`,
          )
          .replace(
            COMPATIBILITY_DATE_JSON,
            `"compatibility_date": "${currentDate}"`,
          )
        writeFileSync(wranglerPath, rewritten)
      } catch {}
    }
  },
)

// AGENTS.md in the starter templates is written for npm. Rewrite its
// commands for the package manager the project was created with.
const PACKAGE_MANAGER_COMMANDS: Record<
  string,
  { install: string; run: string; start: string; exec?: string }
> = {
  bun: {
    install: 'bun install',
    run: 'bun run',
    start: 'bun start',
    exec: 'bunx hono',
  },
  deno: { install: 'deno install', run: 'deno task', start: 'deno task start' },
  pnpm: {
    install: 'pnpm install',
    run: 'pnpm run',
    start: 'pnpm start',
    exec: 'pnpm hono',
  },
  yarn: {
    install: 'yarn install',
    run: 'yarn run',
    start: 'yarn start',
    exec: 'yarn hono',
  },
}

const HONO_CLI_CHOICES = '`npx hono`, `pnpm hono`, `yarn hono`, or `bunx hono`'

export const rewriteAgentsMd = (content: string, packageManager: string) => {
  const commands = PACKAGE_MANAGER_COMMANDS[packageManager]
  if (!commands) {
    return content
  }
  let rewritten = content
    .replaceAll(
      'The commands below are written for npm; substitute yours.',
      `The commands below are written for ${packageManager}.`,
    )
    .replaceAll('`npm install`', `\`${commands.install}\``)
    .replaceAll('`npm run ', `\`${commands.run} `)
    .replaceAll('`npm start`', `\`${commands.start}\``)
  if (commands.exec) {
    rewritten = rewritten
      .replaceAll(
        `run it through the package manager: ${HONO_CLI_CHOICES}`,
        `run it as \`${commands.exec}\``,
      )
      .replaceAll(
        `run \`hono\` through the package manager: ${HONO_CLI_CHOICES}`,
        `run \`hono\` as \`${commands.exec}\``,
      )
  }
  return rewritten
}

afterCreateHook.addHook(
  [
    'aws-lambda',
    'bun',
    'cloudflare-workers',
    'cloudflare-workers+vite',
    'fastly',
    'lambda-edge',
    'nextjs',
    'nodejs',
    'vercel',
    'x-basic',
  ],
  ({ packageManager, directoryPath }) => {
    try {
      const agentsMdPath = path.join(directoryPath, 'AGENTS.md')
      const agentsMd = readFileSync(agentsMdPath, 'utf-8')
      const rewritten = rewriteAgentsMd(agentsMd, packageManager)
      if (rewritten !== agentsMd) {
        writeFileSync(agentsMdPath, rewritten)
      }
    } catch {}
  },
)

export { afterCreateHook }
