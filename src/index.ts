import fs from 'fs'
import path from 'path'
import degit from 'degit'
import { bold, gray, green } from 'kleur/colors'
import prompts from 'prompts'
import yargsParser from 'yargs-parser'
import { version } from '../package.json'
import { viaContentsApi } from './github.js'
import { afterCreateHook } from './hooks/after-create'

const directoryName = 'templates'
const config = {
  directory: directoryName,
  repository: 'starter',
  user: 'honojs',
  ref: 'main',
}

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
  console.log(gray(`\ncreate-hono version ${version}`))

  const args = yargsParser(process.argv.slice(2))

  const templateArg = args.template

  const templateDirs = await viaContentsApi(config)
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
    console.log(`${bold(`${green('✔')} Using target directory`)} … ${target}`)
    projectName = path.basename(target)
  } else {
    const answer = await prompts({
      type: 'text',
      name: 'target',
      message: 'Target directory',
      initial: 'my-app',
    })
    target = answer.target
    if (answer.target === '.') {
      projectName = path.basename(process.cwd())
    } else {
      projectName = path.basename(answer.target)
    }
  }

  const templateName =
    templateArg ||
    (
      await prompts({
        type: 'select',
        name: 'template',
        message: 'Which template do you want to use?',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        choices: templateNames.map((template: any) => ({
          title: template.name,
          value: template.name,
        })),
        initial: 0,
      })
    ).template

  if (!templateName) {
    throw new Error('No template selected')
  }

  if (!templateNames.find((t) => t.name === templateName)) {
    throw new Error(`Invalid template selected: ${templateName}`)
  }

  if (fs.existsSync(target)) {
    if (fs.readdirSync(target).length > 0) {
      const response = await prompts({
        type: 'confirm',
        name: 'value',
        message: 'Directory not empty. Continue?',
        initial: false,
      })
      if (!response.value) {
        process.exit(1)
      }
    }
  } else {
    mkdirp(target)
  }

  await new Promise((res) => {
    const emitter = degit(
      `${config.user}/${config.repository}/${config.directory}/${templateName}#${config.ref}`,
      {
        cache: false,
        force: true,
      }
    )

    emitter.on('info', (info) => {
      console.log(info.message)
    })

    emitter.clone(path.join(process.cwd(), target)).then(() => {
      res({})
    })
  })

  try {
    afterCreateHook.applyHook(templateName, {
      projectName,
      directoryPath: path.join(process.cwd(), target),
    })
  } catch (e) {
    throw new Error(
      `Error running hook for ${templateName}: ${
        e instanceof Error ? e.message : e
      }`
    )
  }

  console.log(bold(green('✔ Copied project files')))
}

main()
