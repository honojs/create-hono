import { downloadTemplate } from '@bluwy/giget-core'
import confirm from '@inquirer/confirm'
import input from '@inquirer/input'
import select from '@inquirer/select'
import { Option, program } from 'commander'
import type { Command } from 'commander'
import { createSpinner } from 'nanospinner'
import * as picocolor from 'picocolors'
import EventEmitter from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { version } from '../package.json'
import { projectDependenciesHook } from './hook'
import { afterCreateHook } from './hooks/after-create'
import {
  knownPackageManagerNames,
  registerInstallationHook,
} from './hooks/dependencies'
import type { EventMap, PackageManager } from './hooks/dependencies'

const [major, minor] = version.split('.')
const ref = `v${major}.${minor}`

const isCurrentDirRegex = /^(\.\/|\.\\|\.)$/
const directoryName = 'templates'
const config = {
  directory: directoryName,
  repository: 'starter',
  user: 'honojs',
  ref,
} as const

const templates = [
  'aws-lambda',
  'bun',
  'cloudflare-workers',
  'cloudflare-workers+vite',
  'deno',
  'fastly',
  'lambda-edge',
  'netlify',
  'nextjs',
  'nodejs',
  'vercel',
  'cloudflare-pages',
  'x-basic',
]

function mkdirp(dir: string) {
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch (e) {
    if (e instanceof Error) {
      if ('code' in e && e.code === 'EEXIST') {
        return
      }
    }
    throw e
  }
}

program
  .name('create-hono')
  .version(version)
  .arguments('[target]')
  .addOption(new Option('-i, --install', 'Install dependencies'))
  .addOption(
    new Option('-p, --pm <pm>', 'Package manager to use').choices(
      knownPackageManagerNames,
    ),
  )
  .addOption(
    new Option('-t, --template <template>', 'Template to use').choices(
      templates,
    ),
  )
  .addOption(new Option('-o, --offline', 'Use offline mode').default(false))
  .action(main)

type ArgOptions = {
  pm?: PackageManager
  offline: boolean
  install?: boolean
  template?: string
}

async function main(
  targetDir: string | undefined,
  options: ArgOptions,
  command: Command,
) {
  console.log(picocolor.gray(`${command.name()} version ${command.version()}`))

  const { install, pm, offline, template: templateArg } = options

  let target = ''
  if (targetDir) {
    target = targetDir
    console.log(
      `${picocolor.bold(`${picocolor.green('✔')} Using target directory`)} … ${target}`,
    )
  } else {
    const answer = await input({
      message: 'Target directory',
      default: 'my-app',
    })
    target = answer
  }

  let projectName = ''
  if (isCurrentDirRegex.test(target)) {
    projectName = path.basename(process.cwd())
  } else {
    projectName = path.basename(target)
  }

  const templateName =
    templateArg ||
    (await select({
      loop: true,
      message: 'Which template do you want to use?',
      choices: templates.map((template) => ({
        title: template,
        value: template,
      })),
      default: 0,
    }))

  if (!templateName) {
    throw new Error('No template selected')
  }

  if (!templates.includes(templateName)) {
    throw new Error(`Invalid template selected: ${templateName}`)
  }

  if (fs.existsSync(target)) {
    if (fs.readdirSync(target).length > 0) {
      const response = await confirm({
        message: 'Directory not empty. Continue?',
        default: false,
      })
      if (!response) {
        // eslint-disable-next-line n/no-process-exit
        process.exit(1)
      }
    }
  } else {
    mkdirp(target)
  }

  const targetDirectoryPath = path.join(process.cwd(), target)

  const emitter = new EventEmitter<EventMap>()

  // Default package manager
  let packageManager = pm ?? 'npm'
  emitter.addListener('packageManager', (pm) => {
    packageManager = pm
  })

  registerInstallationHook(templateName, install, pm, emitter)

  try {
    await Promise.all(
      projectDependenciesHook.applyHook(templateName, {
        directoryPath: targetDirectoryPath,
      }),
    )

    const spinner = createSpinner('Cloning the template').start()

    await downloadTemplate(
      `gh:${config.user}/${config.repository}/${config.directory}/${templateName}#${config.ref}`,
      {
        dir: targetDirectoryPath,
        offline,
        force: true,
      },
    )

    spinner.success()
    emitter.emit('dependencies')

    afterCreateHook.applyHook(templateName, {
      projectName,
      directoryPath: targetDirectoryPath,
      packageManager,
    })
  } catch (e) {
    throw new Error(
      `Error running hook for ${templateName}: ${
        e instanceof Error ? e.message : e
      }`,
    )
  }

  const packageJsonPath = path.join(targetDirectoryPath, 'package.json')

  if (fs.existsSync(packageJsonPath)) {
    const packageJson = fs.readFileSync(packageJsonPath, 'utf-8')

    const packageJsonParsed = JSON.parse(packageJson)
    const newPackageJson = {
      name: projectName,
      ...packageJsonParsed,
    }

    fs.writeFileSync(packageJsonPath, JSON.stringify(newPackageJson, null, 2))
  }

  emitter.on('completed', () => {
    console.log(picocolor.green(`🎉 ${picocolor.bold('Copied project files')}`))
    const resolvedTarget = path.resolve(target)
    const currentDir = process.cwd()

    if (resolvedTarget !== currentDir) {
      console.log(
        picocolor.gray('Get started with:'),
        picocolor.bold(`cd ${target}`),
      )
    }
    // eslint-disable-next-line n/no-process-exit
    process.exit(0)
  })
}

program.parse()
