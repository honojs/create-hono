import { execa, execaSync } from 'execa'
import type { ExecaChildProcess } from 'execa'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Buffer } from 'node:buffer'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { checkPackageManagerInstalled } from './dependencies'

let cmdBuffer = ''

const packageManagersCommands: { [key: string]: string[] } = {
  npm: 'npm run bin'.split(' '),
  bun: 'bun bin'.split(' '),
  pnpm: 'pnpm run bin'.split(' '),
  // Yarn 2+ refuses `yarn run` here, as this repository has no yarn.lock.
  // npm_config_user_agent tells the bin the package manager anyway.
  yarn: [join(cwd(), 'bin')],
}

const knownPackageManagerNames: string[] = Object.keys(packageManagersCommands)

const packageManagersLockfiles: { [key: string]: string } = {
  npm: 'package-lock.json',
  bun: 'bun.lock',
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
}

const installedPackageManagerNames = await Promise.all(
  knownPackageManagerNames.map(checkPackageManagerInstalled),
).then((results: boolean[]) =>
  knownPackageManagerNames.filter((_, index) => results[index]),
)

// Run build to have ./bin
execaSync('bun', 'run build'.split(' '))
execaSync('chmod', ['+x', './bin'])

describe('dependenciesHook', async () => {
  afterAll(() => {
    rmSync('test-dir', { recursive: true, force: true })
    rmSync('bin') // Might be beneficial to remove the bin file
  })

  describe.each(installedPackageManagerNames.map((p) => ({ pm: p })))(
    '$pm',
    { timeout: 60_000 },
    ({ pm }) => {
      // Yarn 2+ would install the app as a part of this repository, so
      // yarn creates it outside
      const root =
        pm === 'yarn' ? mkdtempSync(join(tmpdir(), 'create-hono-')) : cwd()
      const proc = execa(
        packageManagersCommands[pm][0],
        packageManagersCommands[pm].slice(1),
        {
          cwd: root,
          stdin: 'pipe',
          stdout: 'pipe',
          env: { ...process.env, npm_config_user_agent: pm },
        },
      )
      const targetDirectory = `test-dir/${generateRandomAlphanumericString(8)}`
      const targetPath = join(root, targetDirectory)

      beforeAll(() => {
        cmdBuffer = ''
      })

      afterAll(async () => {
        // A test failed before the end. Stop the install before removing
        proc.kill()
        await proc.catch(() => {})
        rmSync(pm === 'yarn' ? root : targetPath, {
          recursive: true,
          force: true,
        })
      })

      it('should ask for a target directory', async () => {
        const out = await handleQuestions(proc, [
          {
            question: 'Target directory',
            answer: answerWithValue(targetDirectory),
          },
        ])

        expect(out).toContain('Target directory')
      })

      it('should ask for a template', async () => {
        const out = await handleQuestions(proc, [
          {
            question: 'Which template do you want to use?',
            answer: CONFIRM, // Should pick aws-lambda
          },
        ])

        expect(out).toContain('aws-lambda')
      })

      it('should ask if you want to install dependencies', async () => {
        const out = await handleQuestions(proc, [
          {
            question: 'Do you want to install project dependencies?',
            answer: CONFIRM, // Should pick Y
          },
        ])

        expect(out).toContain('Do you want to install project dependencies?')
      })

      it('should ask for which package manager to use', async () => {
        const out = await handleQuestions(proc, [
          {
            question: 'Which package manager do you want to use?',
            answer: CONFIRM, // Should pick current package manager
          },
        ])

        expect(out).toContain(`❯ ${pm}`)
      })

      it('should clone the template and install dependencies', async () => {
        // Wait for the exit, as the package manager is still writing
        // files when node_modules appears
        await proc

        expect(existsSync(`${targetPath}/package.json`)).toBe(true)
        // Yarn 2+ uses Plug'n'Play by default, with no node_modules
        expect(
          existsSync(`${targetPath}/node_modules`) ||
            existsSync(`${targetPath}/.pnp.cjs`),
        ).toBe(true)
      })

      it(`should have package manager specific lock file (${packageManagersLockfiles[pm]})`, () => {
        expect(
          existsSync(`${targetPath}/${packageManagersLockfiles[pm]}`),
        ).toBe(true)
      })
    },
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
    const onData = (data: Buffer) => {
      cmdBuffer = (cmdBuffer + data).replace(/\n/g, '')
      const index = questions.findIndex(({ question }) =>
        cmdBuffer.includes(question),
      )

      if (index >= 0) {
        process.stdout?.off('data', onData)
        res(cmdBuffer)
        const { answer } = questions[index]

        writeResponse(process, Array.isArray(answer) ? answer : [answer])
      }
    }
    process.stdout?.on('data', onData)
  })

const writeResponse = (
  process: ExecaChildProcess<string>,
  responses: string[],
) => {
  const response = responses.shift()
  if (!response) {
    return
  }

  if (!response.endsWith(CONFIRM)) {
    process.stdin?.write(Buffer.from(response + CONFIRM))
  } else {
    process.stdin?.write(Buffer.from(response))
  }
}

const answerWithValue = (value = '') => [value, CONFIRM].flat()

const CONFIRM = '\n'
