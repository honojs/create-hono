import { describe, expect, it, vi } from 'vitest'
import { Hook } from './hook'

describe('Hook', () => {
  it('`Hook.applyHook()` runs all hooks for a template', () => {
    const hook = new Hook()
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    hook.addHook('test-template', fn1)
    hook.addHook('test-template', fn2)
    hook.applyHook('test-template', {})
    expect(fn1).toHaveBeenCalled()
    expect(fn2).toHaveBeenCalled()
  })
})
