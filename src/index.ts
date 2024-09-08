import EventEmitter from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { Option, program, type Command } from 'commander'
import { downloadTemplate } from 'giget'
import color from 'picocolors'
import { version } from '../package.json'
import { projectDependenciesHook } from './hook'
import { afterCreateHook } from './hooks/after-create'
import {
  type EventMap,
  knownPackageManagerNames,
  registerInstallationHook,
} from './hooks/dependencies'
import { confirm, select, spinner, text } from './prompts'

const directoryName = 'templates'
const config = {
  directory: directoryName,
  repository: 'starter',
  user: 'honojs',
  ref: 'main',
} as const

const templates = [
  'aws-lambda',
  'bun',
  'cloudflare-pages',
  'cloudflare-workers',
  'deno',
  'fastly',
  'lambda-edge',
  'netlify',
  'nextjs',
  'nodejs',
  'vercel',
  'x-basic',
]

function mkdirp(dir: string) {
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch (e) {
    if (e instanceof Error) {
      if ('code' in e && e.code === 'EEXIST') return
    }
    throw e
  }
}

program
  .name('create-hono')
  .version(version)
  .arguments('[target]')
  .addOption(
    new Option('-i, --install', 'Install dependencies').argParser(Boolean),
  )
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
  .addOption(
    new Option('-o, --offline', 'Use offline mode')
      .argParser(Boolean)
      .default(false),
  )
  .action(main)

type ArgOptions = {
  install: boolean
  offline: boolean
  pm: string
  template: string
}

async function main(
  targetDir: string | undefined,
  options: ArgOptions,
  command: Command,
) {
  console.log(color.gray(`${command.name()} version ${command.version()}`))

  const { install, pm, offline, template: templateArg } = options

  let target = ''
  if (targetDir) {
    target = targetDir
    console.log(
      `${color.bold(`${color.green('✔')} Using target directory`)} … ${target}`,
    )
  } else {
    const answer = await text({
      message: 'Target directory',
      placeholder: 'my-app',
      defaultValue: 'my-app',
    })
    target = answer
  }

  let projectName = ''
  if (target === '.') {
    projectName = path.basename(process.cwd())
  } else {
    projectName = path.basename(target)
  }

  const templateName =
    templateArg ||
    (await select({
      message: 'Which template do you want to use?',
      options: templates.map((template) => ({
        value: template,
      })),
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
        initialValue: false,
      })
      if (!response) {
        process.exit(1)
      }
    }
  } else {
    mkdirp(target)
  }

  const targetDirectoryPath = path.join(process.cwd(), target)

  const emitter = new EventEmitter<EventMap>()

  registerInstallationHook(templateName, install, pm, emitter)

  try {
    await Promise.all(
      projectDependenciesHook.applyHook(templateName, {
        directoryPath: targetDirectoryPath,
      }),
    )

    const s = spinner()
    s.start('Cloning the template')

    await downloadTemplate(
      `gh:${config.user}/${config.repository}/${config.directory}/${templateName}#${config.ref}`,
      {
        dir: targetDirectoryPath,
        offline,
        force: true,
      },
    ).then(() => {
      s.stop('Cloned.')
      emitter.emit('dependencies')
    })

    afterCreateHook.applyHook(templateName, {
      projectName,
      directoryPath: targetDirectoryPath,
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
    console.log(color.green(`🎉 ${color.bold('Copied project files')}`))
    console.log(color.gray('Get started with:'), color.bold(`cd ${target}`))
  })
}

program.parse()
