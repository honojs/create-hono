// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HookSignature = (...args: any[]) => any
export class Hook<HookFunction extends HookSignature> {
  #hookMap: Map<string, HookFunction[]>
  constructor() {
    this.#hookMap = new Map<string, HookFunction[]>()
  }

  addHook(templateName: string | string[], hook: HookFunction) {
    const names = Array.isArray(templateName) ? templateName : [templateName]
    for (const name of names) {
      const hooks = this.#hookMap.get(name) || []
      hooks.push(hook)
      this.#hookMap.set(name, hooks)
    }
  }

  applyHook(
    templateName: string,
    ...hookOptions: Parameters<HookFunction>
  ): ReturnType<HookFunction>[] {
    const hooks = this.#hookMap.get(templateName)
    const results: ReturnType<HookFunction>[] = []
    if (hooks) {
      hooks.forEach((hook) => {
        results.push(hook(...hookOptions))
      })
    }
    return results
  }
}

/**
 * After Hook
 */

type AfterHookOptions = {
  projectName: string
  directoryPath: string
  packageManager: string
}

type AfterHookFunction = (options: AfterHookOptions) => void
export const afterCreateHook = new Hook<AfterHookFunction>()

/**
 * Dependencies Hook
 */

type DependenciesHookOptions = {
  directoryPath: string
}

type DependenciesHookFunction = (options: DependenciesHookOptions) => void
export const projectDependenciesHook = new Hook<DependenciesHookFunction>()
