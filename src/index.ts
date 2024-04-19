import fs from 'fs'
import path from 'path'
import confirm from '@inquirer/confirm'
import input from '@inquirer/input'
import select from '@inquirer/select'
import chalk from 'chalk'
import ora from 'ora'
// @ts-expect-error tiged does not have types
import tiged from 'tiged'
import yargsParser from 'yargs-parser'
import { version } from '../package.json'
import { projectDependenciesHook } from './hook'
import { afterCreateHook } from './hooks/after-create'
import { registerInstallationHook } from './hooks/dependencies'

const directoryName = 'templates'
const config = {
  directory: directoryName,
  repository: 'starter',
  user: 'honojs',
  ref: 'main',
}

const templateDirs = [
  'templates/aws-lambda',
  'templates/bun',
  'templates/cloudflare-pages',
  'templates/cloudflare-workers',
  'templates/deno',
  'templates/fastly',
  'templates/lambda-edge',
  'templates/netlify',
  'templates/nextjs',
  'templates/nodejs',
  'templates/vercel',
  'templates/x-basic',
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

async function main() {
  console.log(chalk.gray(`create-hono version ${version}`))

  const args = yargsParser(process.argv.slice(2))

  const { install, pm, template: templateArg } = args

  const templates: Record<string, { name: string }> = {}

  templateDirs.forEach((dir) => {
    const template = dir.replace(`${directoryName}/`, '')
    if (!templates[template]) {
      templates[template] = {
        name: template,
      }
    }
  })
  const templateNames = [...Object.values(templates)] as { name: string }[]

  let target = ''
  let projectName = ''
  if (args._[0]) {
    target = args._[0].toString()
    console.log(
      `${chalk.bold(`${chalk.green('✔')} Using target directory`)} … ${target}`,
    )
    projectName = path.basename(target)
  } else {
    const answer = await input({
      message: 'Target directory',
      default: 'my-app',
    })
    target = answer
    if (answer === '.') {
      projectName = path.basename(process.cwd())
    } else {
      projectName = path.basename(answer)
    }
  }

  const templateName =
    templateArg ||
    (await select({
      loop: true,
      message: 'Which template do you want to use?',
      choices: templateNames.map((template: { name: string }) => ({
        title: template.name,
        value: template.name,
      })),
      default: 0,
    }))
  if (!templateName) {
    throw new Error('No template selected')
  }

  if (!templateNames.find((t) => t.name === templateName)) {
    throw new Error(`Invalid template selected: ${templateName}`)
  }

  if (fs.existsSync(target)) {
    if (fs.readdirSync(target).length > 0) {
      const response = await confirm({
        message: 'Directory not empty. Continue?',
        default: false,
      })
      if (!response) {
        process.exit(1)
      }
    }
  } else {
    mkdirp(target)
  }

  const targetDirectoryPath = path.join(process.cwd(), target)
  const spinner = ora('Cloning the template').start()

  await new Promise((res) => {
    const emitter = tiged(
      `${config.user}/${config.repository}/${config.directory}/${templateName}#${config.ref}`,
      {
        cache: false,
        force: true,
      },
    )
    emitter.clone(targetDirectoryPath).then(() => {
      spinner.stopAndPersist({
        symbol: chalk.green('✔'),
      })
      res({})
    })
  })

  registerInstallationHook(templateName, install, pm)

  try {
    afterCreateHook.applyHook(templateName, {
      projectName,
      directoryPath: targetDirectoryPath,
    })

    await Promise.all(
      projectDependenciesHook.applyHook(templateName, {
        directoryPath: targetDirectoryPath,
      }),
    )
  } catch (e) {
    throw new Error(
      `Error running hook for ${templateName}: ${
        e instanceof Error ? e.message : e
      }`,
    )
  }

  console.log(chalk.green('🎉 ' + chalk.bold('Copied project files')))
  console.log(chalk.gray('Get started with:'), chalk.bold(`cd ${target}`))
}

main()
