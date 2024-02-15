import { chdir, exit } from "process";
import { projectDependenciesHook } from "../hook";
import { exec } from "child_process";
import prompts from 'prompts'
import { bold, green, red } from "kleur/colors";

type PackageManager  = 'npm' | 'bun' | 'pnpm' | 'yarn'

const KNOWN_PACKAGE_MANAGERS: {[key: string]: string} = {
  'npm': 'npm install',
  'bun': 'bun install',
  'pnpm': 'pnpm install',
  'yarn': 'yarn'
};

const KNOWN_PACKAGE_MANAGER_NAMES = Object.keys(KNOWN_PACKAGE_MANAGERS);

const CURRENT_PACKAGE_MANAGER = getCurrentPackageManager()

const registerInstallationHook = (template: string) => {
  if (template == "deno") return; // Deno needs no dependency installation step

  projectDependenciesHook.addHook(template, async ({directoryPath}) => {
    const {installDeps} = (
      await prompts({
        type: 'confirm',
        name: 'installDeps',
        message: 'Do you want to install project dependencies?',
        initial: true,
      })
    )

    if (!installDeps) return;

    const {packageManager} = (
      await prompts({
        type: 'select',
        name: 'packageManager',
        message: 'Which package manager do you want to use?',
        choices: KNOWN_PACKAGE_MANAGER_NAMES.map((template: string) => ({
          title: template,
          value: template,
        })),
        initial: KNOWN_PACKAGE_MANAGER_NAMES.indexOf(CURRENT_PACKAGE_MANAGER),
      })
    );

    chdir(directoryPath);

    if (!KNOWN_PACKAGE_MANAGERS[packageManager]) {
      exit(1)
    }

    const proc = exec(KNOWN_PACKAGE_MANAGERS[packageManager])

    const procExit: number = await new Promise((res) => {
      proc.on("exit", (code) => res(code == null ? 0xff : code))
    });

    if (procExit == 0) {
      console.log(bold(`${green('✔')} Installed project dependencies`))
    } else {
      console.log(bold(`${red('×')} Failed to install project dependencies`))
      exit(procExit)
    }

    return;
  })
}

function getCurrentPackageManager(): PackageManager {
  const agent = process.env.npm_config_user_agent || "npm"; // Types say it might be undefined, just being cautious;

  if (agent.startsWith('bun')) return 'bun';
  else if (agent.startsWith('pnpm')) return 'pnpm';
  else if (agent.startsWith('yarn')) return 'yarn';

  return 'npm'
}

export { registerInstallationHook };