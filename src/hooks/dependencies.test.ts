import {execa, ExecaChildProcess} from 'execa';
import { Buffer } from 'buffer'

import { afterAll, describe, expect, it } from 'vitest'
import { existsSync, rmSync } from 'fs';
import { cwd } from 'process';

let cmdBuffer = '';

const packageManagersCommands: {[key: string]: string[]} = {
  'npm': 'npm run bin'.split(' '),
  'bun': 'bun bin'.split(' '),
  'pnpm': 'pnpm run bin'.split(' '),
  'yarn': 'yarn run bin'.split(' ')
}

const packageManagersLockfiles: {[key: string]: string} = {
  'npm': 'package-lock.json',
  'bun': 'bun.lockb',
  'pnpm': 'pnpm-lock.yml',
  'yarn': 'yarn.lock'
}

const packageManagers = Object.keys(packageManagersCommands)

describe('dependenciesHook', () => {
  afterAll(() => rmSync('test-dir', {recursive: true, force: true}))
  
  describe.each(packageManagers.map(p => ({pm: p})))("$pm", ({pm}) => {
    const proc = execa(packageManagersCommands[pm][0], packageManagersCommands[pm].slice(1), {
      cwd: cwd(),
      stdin: 'pipe',
      stdout: 'pipe',
      env: {...process.env, npm_config_user_agent: pm}
    });
    const targetDirectory = 'test-dir/' + generateRandomAlphanumericString(8);

    afterAll(() => {
      rmSync(targetDirectory, {recursive: true, force: true})
    })

    it("should ask for a target directory", async (ctx) => {
      const out = await handleQuestions(proc, [
        {
          question: 'Target directory',
          answer: answerWithValue(targetDirectory)
        }
      ])

      expect(out)
    })

    it('should clone a template to the directory', async () => {
      const out = await handleQuestions(proc, [
        {
          question: 'Which template do you want to use?',
          answer: CONFIRM // Should pick aws-lambda
        }
      ]);

      expect(out, "Selected aws-lambda")
    })

    it('should ask if you want to install dependencies', async () => {
      const out = await handleQuestions(proc, [
        {
          question: 'Do you want to install project dependencies?',
          answer: CONFIRM // Should pick Y
        }
      ]);

      expect(out, "Installing dependencies")
    })

    it('should ask for which package manager to use', async () => {
      const out = await handleQuestions(proc, [
        {
          question: 'Which package manager do you want to use?',
          answer: CONFIRM // Should pick current package manager
        }
      ]);

      expect(out.trim().includes(pm), `Current package manager '${pm}' was picked`)
    })

    it('should have installed dependencies', async () => {
      while(!existsSync(targetDirectory + '/node_modules')) await timeout(3_000) // 3 seconds;

      expect(existsSync(targetDirectory + '/node_modules'), "node_modules directory exists")
    })

    it('should have package manager specific lock file (' + packageManagersLockfiles[pm] + ')', async () => {
      expect(existsSync(targetDirectory + '/' + packageManagersLockfiles[pm]), "lockfile exists")

      cmdBuffer = ''
    })
  }, {timeout: 60_000})
})

const generateRandomAlphanumericString = (length: number): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    result += alphabet[randomIndex];
  }

  return result;
};

const procOutput = (proc: ExecaChildProcess<string>) => new Promise((res, rej) => {
  proc.stdout?.once('data', res);
  proc.stderr?.once('data', rej);

  proc.stdout?.once('error', rej);
  proc.stderr?.once('error', rej);
})

const timeout = (milliseconds: number) => new Promise((res, rej) => setTimeout(res, milliseconds));

/**
 * Utility to mock the stdin of the cli. You must provide the correct number of
 * questions correctly typed or the process will keep waiting for input.
 * @param {ExecaChildProcess<string>} process
 * @param {Array<{question: string, answer: string|string[]}>} questions
 * @param {Array<number>} prompts
 *  - questions that you know the CLI will ask and respective answers to mock
 */
const handleQuestions = (process: ExecaChildProcess<string>, questions: {question: string, answer: string| string[]}[]) => new Promise<string>((res, rej) => {
  process.stdout?.on('data', (data) => {
    cmdBuffer = (cmdBuffer + data).replace(/\n/g, '')
    const index = questions.findIndex(
      ({ question }) => cmdBuffer.includes(question)
    )

    if (index >= 0) {
      res(cmdBuffer)
      const { answer } = questions[index]

      writeResponse(process, Array.isArray(answer) ? answer : [answer])
    }
  })
})

const writeResponse = (process: ExecaChildProcess<string>, responses: string[]) => {
  const response = responses.shift()
  if (!response) return;

  if (!response.endsWith(CONFIRM)) process.stdin?.write(Buffer.from(response + CONFIRM))
  else process.stdin?.write(Buffer.from(response))
}

export const answerWithValue = (value = '') => [value, CONFIRM].flat()

export const CONFIRM = '\n'
