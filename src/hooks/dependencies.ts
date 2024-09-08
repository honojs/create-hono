import { exec } from 'node:child_process'
import type { EventEmitter } from 'node:events'
import { chdir, exit } from 'node:process'
import { execa } from 'execa'
import color from 'picocolors'
import { projectDependenciesHook } from '../hook'
import { confirm, select, spinner } from '../prompts'

type PackageManager = 'npm' | 'bun' | 'pnpm' | 'yarn'

const knownPackageManagers: { [key: string]: string } = {
  npm: 'npm install',
  bun: 'bun install',
  pnpm: 'pnpm install',
  yarn: 'yarn',
}

export const knownPackageManagerNames = Object.keys(knownPackageManagers)
const currentPackageManager = getCurrentPackageManager()

// Deno and Netlify need no dependency installation step
const excludeTemplate = ['deno', 'netlify']

export type EventMap = { dependencies: unknown[]; completed: unknown[] }

const registerInstallationHook = (
  template: string,
  installArg: boolean | undefined,
  pmArg: string,
  emitter: EventEmitter<EventMap>,
) => {
  if (excludeTemplate.includes(template)) return

  projectDependenciesHook.addHook(template, async ({ directoryPath }) => {
    let installDeps = false

    const installedPackageManagerNames = await Promise.all(
      knownPackageManagerNames.map(checkPackageManagerInstalled),
    ).then((results) =>
      knownPackageManagerNames.filter((_, index) => results[index]),
    )

    // hide install dependencies option if no package manager is installed
    if (!installedPackageManagerNames.length) return

    if (typeof installArg === 'boolean') {
      installDeps = installArg
    } else {
      installDeps = await confirm({
        message: 'Do you want to install project dependencies?',
        initialValue: true,
      })
    }

    if (!installDeps) return

    let packageManager: string

    if (pmArg && installedPackageManagerNames.includes(pmArg)) {
      packageManager = pmArg
    } else {
      packageManager = await select({
        message: 'Which package manager do you want to use?',
        options: installedPackageManagerNames.map((template: string) => ({
          value: template,
        })),
        initialValue: currentPackageManager,
      })
    }

    emitter.on('dependencies', async () => {
      chdir(directoryPath)

      if (!knownPackageManagers[packageManager]) {
        exit(1)
      }

      const s = spinner()
      s.start('Installing project dependencies')
      const proc = exec(knownPackageManagers[packageManager])

      const procExit: number = await new Promise((res) => {
        proc.on('exit', (code) => res(code == null ? 0xff : code))
      })

      if (procExit === 0) {
        s.stop('Installed successfully.')
      } else {
        s.stop(`${color.red('×')} Failed to install project dependencies`)
        exit(procExit)
      }

      emitter.emit('completed')
    })

    return
  })
}

function getCurrentPackageManager(): PackageManager {
  const agent = process.env.npm_config_user_agent || 'npm' // Types say it might be undefined, just being cautious;

  if (agent.startsWith('bun')) return 'bun'
  if (agent.startsWith('pnpm')) return 'pnpm'
  if (agent.startsWith('yarn')) return 'yarn'

  return 'npm'
}

function checkPackageManagerInstalled(packageManager: string) {
  return new Promise<boolean>((resolve) => {
    execa(packageManager, ['--version'])
      .then(() => resolve(true))
      .catch(() => resolve(false))
  })
}

export { registerInstallationHook, checkPackageManagerInstalled }
