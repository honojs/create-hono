import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getWorkerdDate, setCompatibilityDate } from './compatibility-date'

describe('compatibility date', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'create-hono-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const installHoisted = (version: string) => {
    mkdirSync(join(dir, 'node_modules', 'workerd'), { recursive: true })
    writeFileSync(
      join(dir, 'node_modules', 'workerd', 'package.json'),
      JSON.stringify({ name: 'workerd', version }),
    )
  }

  const installInStore = (store: string, name: string) => {
    mkdirSync(join(dir, 'node_modules', store, name), { recursive: true })
  }

  it('reads the date of a hoisted workerd', () => {
    installHoisted('1.20261019.1')
    expect(getWorkerdDate(dir)).toBe('2026-10-19')
  })

  it('reads the date of workerd in the pnpm store, the oldest one', () => {
    installInStore('.pnpm', 'workerd@1.20261026.1')
    installInStore('.pnpm', 'workerd@1.20261019.1')
    installInStore('.pnpm', '@cloudflare+workerd-darwin-arm64@1.20261001.1')
    expect(getWorkerdDate(dir)).toBe('2026-10-19')
  })

  it('returns undefined without workerd', () => {
    expect(getWorkerdDate(dir)).toBeUndefined()
  })

  it('sets the date of the installed workerd in the config files', () => {
    installInStore('.pnpm', 'workerd@1.20261019.1')
    writeFileSync(
      join(dir, 'cloudflare.config.ts'),
      'export default defineConfig({ worker: { compatibilityDate: "2026-10-06" } })',
    )
    writeFileSync(
      join(dir, 'wrangler.jsonc'),
      '{ "compatibility_date": "2026-10-06" }',
    )

    setCompatibilityDate(dir)

    expect(readFileSync(join(dir, 'cloudflare.config.ts'), 'utf-8')).toMatch(
      /compatibilityDate: '2026-10-19'/,
    )
    expect(readFileSync(join(dir, 'wrangler.jsonc'), 'utf-8')).toBe(
      '{ "compatibility_date": "2026-10-19" }',
    )
  })

  it('keeps the date of the template without workerd', () => {
    writeFileSync(
      join(dir, 'wrangler.toml'),
      'compatibility_date = "2026-10-06"',
    )
    setCompatibilityDate(dir)
    expect(readFileSync(join(dir, 'wrangler.toml'), 'utf-8')).toBe(
      'compatibility_date = "2026-10-06"',
    )
  })
})
