import { chdir, cwd, exit } from "process";
import { projectDependenciesHook } from "../hook";
import { exec } from "child_process";
import prompts from 'prompts'
import { bold, green, red } from "kleur/colors";

const KNOWN_PACKAGE_MANAGERS: {[key: string]: string} = {
  'npm': 'npm install',
  'bun': 'bun install',
  'pnpm': 'pnpm install',
  'yarn': 'yarn'
};

const registerInstallationHook = (template: string) => {
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

    const currentDirectory = cwd()

    const {packageManager} = (
      await prompts({
        type: 'select',
        name: 'packageManager',
        message: 'Which package manager do you want to use?',
        choices: Object.keys(KNOWN_PACKAGE_MANAGERS).map((template: string) => ({
          title: template,
          value: template,
        })),
        initial: 0,
      })
    );

    chdir(directoryPath);

    const proc = exec(KNOWN_PACKAGE_MANAGERS[packageManager])

    const procExit: number = await new Promise((res) => {
      proc.on("exit", (code) => res(code == null ? 0xff : code))
    });

    if (procExit == 0) {
      console.log(bold(`${green('✔')} Installed project dependencies`))
    } else {
      console.log(bold(`${red('×')} Failed to installed project dependencies`))
      exit(procExit)
    }

    chdir(currentDirectory);

    return;
  })
}

export { registerInstallationHook };