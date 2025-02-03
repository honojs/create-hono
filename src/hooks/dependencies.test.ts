import { Buffer } from 'node:buffer'
import { existsSync, rmSync } from 'node:fs'
import { cwd } from 'node:process'
import { execa, execaSync } from 'execa'
import type { ExecaChildProcess } from 'execa'
import { afterAll, describe, expect, it } from 'vitest'
import { checkPackageManagerInstalled } from './dependencies'

let cmdBuffer = ''

const packageManagersCommands: { [key: string]: string[] } = {
  npm: 'npm run bin'.split(' '),
  bun: 'bun bin'.split(' '),
  pnpm: 'pnpm run bin'.split(' '),
  yarn: 'yarn run bin'.split(' '),
}

const knownPackageManagerNames: string[] = Object.keys(packageManagersCommands)

const packageManagersLockfiles: { [key: string]: string } = {
  npm: 'package-lock.json',
  bun: 'bun.lock',
  pnpm: 'pnpm-lock.yml',
  yarn: 'yarn.lock',
}

const installedPackageManagerNames = await Promise.all(
  knownPackageManagerNames.map(checkPackageManagerInstalled),
).then((results: boolean[]) =>
  knownPackageManagerNames.filter((_, index) => results[index]),
)

// Run build to have ./bin
execaSync('yarn', 'run build'.split(' '))
execaSync('chmod', ['+x', './bin'])

describe('dependenciesHook', async () => {
  afterAll(() => {
    rmSync('test-dir', { recursive: true, force: true })
    rmSync('bin') // Might be beneficial to remove the bin file
  })

  describe.each(installedPackageManagerNames.map((p) => ({ pm: p })))(
    '$pm',
    ({ pm }) => {
      const proc = execa(
        packageManagersCommands[pm][0],
        packageManagersCommands[pm].slice(1),
        {
          cwd: cwd(),
          stdin: 'pipe',
          stdout: 'pipe',
          env: { ...process.env, npm_config_user_agent: pm },
        },
      )
      const targetDirectory = `test-dir/${generateRandomAlphanumericString(8)}`

      afterAll(() => {
        rmSync(targetDirectory, { recursive: true, force: true })
      })

      it('should ask for a target directory', async () => {
        const out = await handleQuestions(proc, [
          {
            question: 'Target directory',
            answer: answerWithValue(targetDirectory),
          },
        ])

        expect(out)
      })

      it('should clone a template to the directory', async () => {
        const out = await handleQuestions(proc, [
          {
            question: 'Which template do you want to use?',
            answer: CONFIRM, // Should pick aws-lambda
          },
        ])

        expect(out, 'Selected aws-lambda')
      })

      it('should ask if you want to install dependencies', async () => {
        const out = await handleQuestions(proc, [
          {
            question: 'Do you want to install project dependencies?',
            answer: CONFIRM, // Should pick Y
          },
        ])

        expect(out, 'Installing dependencies')
      })

      it('should ask for which package manager to use', async () => {
        const out = await handleQuestions(proc, [
          {
            question: 'Which package manager do you want to use?',
            answer: CONFIRM, // Should pick current package manager
          },
        ])

        expect(
          out.trim().includes(pm),
          `Current package manager '${pm}' was picked`,
        )
      })

      it('should have installed dependencies', async () => {
        while (!existsSync(`${targetDirectory}/node_modules`))
          await timeout(5_000) // 3 seconds;

        expect(
          existsSync(`${targetDirectory}/node_modules`),
          'node_modules directory exists',
        )
      })

      it(`should have package manager specific lock file (${packageManagersLockfiles[pm]})`, async () => {
        expect(
          existsSync(`${targetDirectory}/${packageManagersLockfiles[pm]}`),
          'lockfile exists',
        )

        cmdBuffer = ''
      })
    },
    { timeout: 60_000 },
  )
})

const generateRandomAlphanumericString = (length: number): string => {
  const alphabet =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * alphabet.length)
    result += alphabet[randomIndex]
  }

  return result
}

const timeout = (milliseconds: number) =>
  new Promise((res) => setTimeout(res, milliseconds))

/**
 * Utility to mock the stdin of the cli. You must provide the correct number of
 * questions correctly typed or the process will keep waiting for input.
 * https://github.com/netlify/cli/blob/0c91f20e14e84e9b21d39d592baf10c7abd8f37c/tests/integration/utils/handle-questions.js#L11
 */
const handleQuestions = (
  process: ExecaChildProcess<string>,
  questions: { question: string; answer: string | string[] }[],
) =>
  new Promise<string>((res) => {
    process.stdout?.on('data', (data) => {
      cmdBuffer = (cmdBuffer + data).replace(/\n/g, '')
      const index = questions.findIndex(({ question }) =>
        cmdBuffer.includes(question),
      )

      if (index >= 0) {
        res(cmdBuffer)
        const { answer } = questions[index]

        writeResponse(process, Array.isArray(answer) ? answer : [answer])
      }
    })
  })

const writeResponse = (
  process: ExecaChildProcess<string>,
  responses: string[],
) => {
  const response = responses.shift()
  if (!response) return

  if (!response.endsWith(CONFIRM))
    process.stdin?.write(Buffer.from(response + CONFIRM))
  else process.stdin?.write(Buffer.from(response))
}

const answerWithValue = (value = '') => [value, CONFIRM].flat()

const CONFIRM = '\n'
