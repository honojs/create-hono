export class Hook<HookFunction extends (...args: any[]) => any> {
  #hookMap: Map<string, HookFunction[]>
  constructor() {
    this.#hookMap = new Map<string, HookFunction[]>()
  }

  addHook(templateName: string, hook: HookFunction) {
    const hooks = this.#hookMap.get(templateName) || []
    hooks.push(hook)
    this.#hookMap.set(templateName, hooks)
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
