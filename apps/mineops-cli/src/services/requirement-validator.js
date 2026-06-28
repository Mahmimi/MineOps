import { ValidationError } from '../domain/errors.js';

export class RequirementValidator {
  constructor({ runner }) {
    this.runner = runner;
  }

  checkOs() {
    const supported = ['win32', 'linux', 'darwin'];
    if (!supported.includes(process.platform)) {
      throw new ValidationError(`Unsupported OS: ${process.platform}`);
    }
    return `${process.platform} ${process.arch}`;
  }

  checkCommands() {
    const commands = ['docker', 'k3d', 'kubectl', 'terraform', 'node', 'powershell'];
    const missing = commands.filter((command) => !this.runner.hasCommand(command));
    if (missing.length > 0) {
      throw new ValidationError(`Missing required command(s): ${missing.join(', ')}`);
    }
    return commands;
  }

  checkDocker() {
    this.runner.run('docker', ['ps'], { capture: true });
    return true;
  }

  validate(mineopsConfig) {
    const os = this.checkOs();
    const commands = this.checkCommands();
    this.checkDocker();
    return { os, commands, env: mineopsConfig.globals.env };
  }
}