import confirm from '@inquirer/confirm'
import select from '@inquirer/select'
import spawn, { SubprocessError } from 'nano-spawn'
import { createSpinner } from 'nanospinner'
import * as picocolor from 'picocolors'
import type { EventEmitter } from 'node:events'
import { exit } from 'node:process'
import { projectDependenciesHook } from '../hook'

type PackageManager = 'npm' | 'bun' | 'deno' | 'pnpm' | 'yarn'

const knownPackageManagers: { [key: string]: string } = {
  npm: 'npm install',
  bun: 'bun install',
  deno: 'deno install',
  pnpm: 'pnpm install',
  yarn: 'yarn',
}

export const knownPackageManagerNames = Object.keys(knownPackageManagers)
const currentPackageManager = getCurrentPackageManager()

// Deno and Netlify need no dependency installation step
const excludeTemplate = ['deno', 'netlify']

export type EventMap = {
  dependencies: unknown[]
  packageManager: unknown[]
  completed: unknown[]
}

const registerInstallationHook = (
  template: string,
  installArg: boolean | undefined,
  pmArg: string | undefined,
  emitter: EventEmitter<EventMap>,
) => {
  if (excludeTemplate.includes(template)) {
    return
  }

  projectDependenciesHook.addHook(template, async ({ directoryPath }) => {
    let installDeps = false

    const installedPackageManagerNames = await Promise.all(
      knownPackageManagerNames.map(checkPackageManagerInstalled),
    ).then((results) =>
      knownPackageManagerNames.filter((_, index) => results[index]),
    )

    // hide install dependencies option if no package manager is installed
    if (!installedPackageManagerNames.length) {
      return
    }
    // If version 1 of Deno is installed, it will not be suggested because it doesn't have "deno install".
    if (installedPackageManagerNames.includes('deno')) {
      let isVersion1 = false
      try {
        const { stdout } = await spawn('deno', ['-v'], { timeout: 3000 })
        isVersion1 = stdout.split(' ')[1].split('.')[0] === '1'
      } catch {
        isVersion1 = true
      }
      if (isVersion1) {
        installedPackageManagerNames.splice(
          installedPackageManagerNames.indexOf('deno'),
          1,
        )
      }
    }

    if (typeof installArg === 'boolean') {
      installDeps = installArg
    } else {
      installDeps = await confirm({
        message: 'Do you want to install project dependencies?',
        default: true,
      })
    }

    if (!installDeps) {
      return
    }

    let packageManager: string

    if (pmArg) {
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

    emitter.emit('packageManager', packageManager)

    emitter.on('dependencies', async () => {
      if (!knownPackageManagers[packageManager]) {
        exit(1)
      }

      const spinner = createSpinner('Installing project dependencies').start()

      const [command, ...args] = knownPackageManagers[packageManager].split(' ')

      try {
        await spawn(command, args, {
          cwd: directoryPath,
          // On Windows, stderr from cmd.exe is encoded in the OEM code page (e.g. CP932),
          // which causes garbled text when Node.js reads it as UTF-8.
          // Using 'inherit' pipes stderr directly to the terminal to avoid this.
          stderr: 'inherit',
        })
      } catch (error: unknown) {
        if (error instanceof SubprocessError) {
          spinner.stop({
            mark: picocolor.red('×'),
            text: 'Failed to install project dependencies',
          })
          exit(error.exitCode ?? 1)
        }
        throw error
      }

      spinner.success()

      emitter.emit('completed')
    })

    return
  })
}

function getCurrentPackageManager(): PackageManager {
  const agent = process.env.npm_config_user_agent || 'npm' // Types say it might be undefined, just being cautious;

  if (agent.startsWith('bun')) {
    return 'bun'
  }
  if (agent.startsWith('deno')) {
    return 'deno'
  }
  if (agent.startsWith('pnpm')) {
    return 'pnpm'
  }
  if (agent.startsWith('yarn')) {
    return 'yarn'
  }

  return 'npm'
}

function checkPackageManagerInstalled(packageManager: string) {
  return new Promise<boolean>((resolve) => {
    spawn(packageManager, ['--version'], { timeout: 3000 })
      .then(() => resolve(true))
      .catch(() => resolve(false))
  })
}

export { registerInstallationHook, checkPackageManagerInstalled }
