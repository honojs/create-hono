import { exec } from 'child_process'
import { chdir, exit } from 'process'
import confirm from '@inquirer/confirm'
import select from '@inquirer/select'
import chalk from 'chalk'
import { execa } from 'execa'
import { createSpinner } from 'nanospinner'
import { projectDependenciesHook } from '../hook'

type PackageManager = 'npm' | 'bun' | 'pnpm' | 'yarn'

const knownPackageManagers: { [key: string]: string } = {
  npm: 'npm install',
  bun: 'bun install',
  pnpm: 'pnpm install',
  yarn: 'yarn',
}

const knownPackageManagerNames = Object.keys(knownPackageManagers)
const currentPackageManager = getCurrentPackageManager()

// Deno and Netlify need no dependency installation step
const excludeTemplate = ['deno', 'netlify']

const registerInstallationHook = (
  template: string,
  installArg: boolean | undefined,
  pmArg: string,
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
    if (installedPackageManagerNames.length) return

    if (typeof installArg === 'boolean') {
      installDeps = installArg
    } else {
      installDeps = await confirm({
        message: 'Do you want to install project dependencies?',
        default: true,
      })
    }

    if (!installDeps) return

    let packageManager

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

    chdir(directoryPath)

    if (!knownPackageManagers[packageManager]) {
      exit(1)
    }

    const spinner = createSpinner('Installing project dependencies').start()
    const proc = exec(knownPackageManagers[packageManager])

    const procExit: number = await new Promise((res) => {
      proc.on('exit', (code) => res(code == null ? 0xff : code))
    })

    if (procExit == 0) {
      spinner.success()
    } else {
      spinner.stop({
        mark: chalk.red('×'),
        text: 'Failed to install project dependencies',
      })
      exit(procExit)
    }

    return
  })
}

function getCurrentPackageManager(): PackageManager {
  const agent = process.env.npm_config_user_agent || 'npm' // Types say it might be undefined, just being cautious;

  if (agent.startsWith('bun')) return 'bun'
  else if (agent.startsWith('pnpm')) return 'pnpm'
  else if (agent.startsWith('yarn')) return 'yarn'

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
