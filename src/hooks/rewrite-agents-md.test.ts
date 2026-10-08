import { describe, expect, it } from 'vitest'
import { rewriteAgentsMd } from './after-create'

const agentsMd = `
Use the package manager this project was created with. The lockfile tells you which: \`package-lock.json\` is npm, \`pnpm-lock.yaml\` is pnpm, \`yarn.lock\` is yarn, \`bun.lock\` is bun. The commands below are written for npm; substitute yours.

- \`npm install\`
- \`npm run dev\` starts the server with tsx in watch mode. It is for humans; do not start it to check your work.
- \`npm run build\` compiles with tsc to \`dist/\`; \`npm start\` runs it.

Verify with the Hono CLI, not with throwaway scripts or a dev server. It is a dev dependency (run it through the package manager: \`npx hono\`, \`pnpm hono\`, \`yarn hono\`, or \`bunx hono\`), loads the app in-process with \`app.request()\`, and prints JSON.

- \`hono routes src/app.ts\` lists the routes; \`hono request / src/app.ts\` sends one request.
`.trim()

describe('rewriteAgentsMd', () => {
  it('leaves the content as is for npm', () => {
    expect(rewriteAgentsMd(agentsMd, 'npm')).toBe(agentsMd)
  })

  it('rewrites the commands for pnpm', () => {
    const result = rewriteAgentsMd(agentsMd, 'pnpm')
    expect(result).toContain('The commands below are written for pnpm.')
    expect(result).toContain('- `pnpm install`')
    expect(result).toContain('- `pnpm run dev` starts')
    expect(result).toContain('`pnpm run build` compiles')
    expect(result).toContain('`pnpm start` runs it')
    expect(result).toContain(
      'It is a dev dependency (run it as `pnpm hono`), loads',
    )
    expect(result).not.toContain('`npm ')
    expect(result).not.toContain('npx')
    // the lockfile hint and the Hono CLI commands stay
    expect(result).toContain(
      '`package-lock.json` is npm, `pnpm-lock.yaml` is pnpm',
    )
    expect(result).toContain('- `hono routes src/app.ts` lists the routes')
  })

  it('uses bunx for bun', () => {
    const result = rewriteAgentsMd(agentsMd, 'bun')
    expect(result).toContain('- `bun install`')
    expect(result).toContain('- `bun run dev` starts')
    expect(result).toContain('`bun start` runs it')
    expect(result).toContain('run it as `bunx hono`')
  })

  it('uses yarn for yarn', () => {
    const result = rewriteAgentsMd(agentsMd, 'yarn')
    expect(result).toContain('- `yarn install`')
    expect(result).toContain('- `yarn run dev` starts')
    expect(result).toContain('run it as `yarn hono`')
  })

  it('rewrites install and scripts for deno but keeps the Hono CLI choices', () => {
    const result = rewriteAgentsMd(agentsMd, 'deno')
    expect(result).toContain('- `deno install`')
    expect(result).toContain('- `deno task dev` starts')
    expect(result).toContain(
      '`npx hono`, `pnpm hono`, `yarn hono`, or `bunx hono`',
    )
  })
})
