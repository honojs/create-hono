import { describe, expect, it } from 'vitest'
import { capturedSpawnOutput } from './dependencies'

describe('capturedSpawnOutput', () => {
  it('returns the package manager output that nano-spawn captured', () => {
    expect(
      capturedSpawnOutput({
        output:
          '[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.28.2\n',
      }),
    ).toBe('[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.28.2')
  })

  it('returns empty when spawn captured nothing', () => {
    expect(capturedSpawnOutput({ output: '' })).toBe('')
    expect(capturedSpawnOutput({ output: '   \n' })).toBe('')
    expect(capturedSpawnOutput({})).toBe('')
  })
})
