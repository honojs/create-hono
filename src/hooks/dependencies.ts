import { exec } from 'child_process'
import { chdir, exit } from 'process'
import confirm from '@inquirer/confirm'
import select from '@inquirer/select'
import chalk from 'chalk'
import ora from 'ora'
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

const registerInstallationHook = (
  template: string,
  installArg: boolean,
  pmArg: string,
) => {
  if (template == 'deno') return // Deno needs no dependency installation step

  projectDependenciesHook.addHook(template, async ({ directoryPath }) => {
    let installDeps = false

    if (installArg) {
      installDeps = true
    } else {
      installDeps = await confirm({
        message: 'Do you want to install project dependencies?',
        default: true,
      })
    }

    if (!installDeps) return

    let packageManager

    if (pmArg && knownPackageManagerNames.includes(pmArg)) {
      packageManager = pmArg
    } else {
      packageManager = await select({
        message: 'Which package manager do you want to use?',
        choices: knownPackageManagerNames.map((template: string) => ({
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

    const spinner = ora('Installing project dependencies').start()
    const proc = exec(knownPackageManagers[packageManager])

    const procExit: number = await new Promise((res) => {
      proc.on('exit', (code) => res(code == null ? 0xff : code))
    })

    spinner.stop().clear()

    if (procExit == 0) {
      spinner.stopAndPersist({
        symbol: chalk.green('✔'),
      })
    } else {
      console.log(`${chalk.red('×')} Failed to install project dependencies`)
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

export { registerInstallationHook }
