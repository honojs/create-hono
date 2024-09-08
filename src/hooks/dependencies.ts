import { exec } from 'node:child_process'
import type { EventEmitter } from 'node:events'
import { chdir, exit } from 'node:process'
import confirm from '@inquirer/confirm'
import select from '@inquirer/select'
import { execa } from 'execa'
import { createSpinner } from 'nanospinner'
import color from 'picocolors'
import { projectDependenciesHook } from '../hook'

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
        default: true,
      })
    }

    if (!installDeps) return

    let packageManager: string

    if (pmArg && installedPackageManagerNames.includes(pmArg)) {
      packageManager = pmArg
    } else {
      packageManager = await select({
        message: 'Which package manager do you want to use?',
        choices: installedPackageManagerNames.map((template: string) => ({
          title: template,
          value: template,
        })),
        default: currentPackageManager,
      })
    }

    emitter.on('dependencies', async () => {
      chdir(directoryPath)

      if (!knownPackageManagers[packageManager]) {
        exit(1)
      }

      const spinner = createSpinner('Installing project dependencies').start()
      const proc = exec(knownPackageManagers[packageManager])

      const procExit: number = await new Promise((res) => {
        proc.on('exit', (code) => res(code == null ? 0xff : code))
      })

      if (procExit === 0) {
        spinner.success()
      } else {
        spinner.stop({
          mark: color.red('×'),
          text: 'Failed to install project dependencies',
        })
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
