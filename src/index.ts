import fs from 'fs'
import path from 'path'
import confirm from '@inquirer/confirm'
import input from '@inquirer/input'
import select from '@inquirer/select'
import chalk from 'chalk'
import { downloadTemplate } from 'giget'
import { createSpinner } from 'nanospinner'
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

async function main() {
  console.log(chalk.gray(`create-hono version ${version}`))

  const args = yargsParser(process.argv.slice(2))

  const { install, pm, template: templateArg } = args

  let target = ''
  if (args._[0]) {
    target = args._[0].toString()
    console.log(
      `${chalk.bold(`${chalk.green('✔')} Using target directory`)} … ${target}`,
    )
  } else {
    const answer = await input({
      message: 'Target directory',
      default: 'my-app',
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
        process.exit(1)
      }
    }
  } else {
    mkdirp(target)
  }

  const targetDirectoryPath = path.join(process.cwd(), target)
  const spinner = createSpinner('Cloning the template').start()

  await downloadTemplate(
    `${config.user}/${config.repository}/${config.directory}/${templateName}#${config.ref}`,
    {
      dir: targetDirectoryPath,
      offline: false,
      force: true,
    },
  ).then(() => spinner.success())

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

  console.log(chalk.green(`🎉 ${chalk.bold('Copied project files')}`))
  console.log(chalk.gray('Get started with:'), chalk.bold(`cd ${target}`))
}

main()
