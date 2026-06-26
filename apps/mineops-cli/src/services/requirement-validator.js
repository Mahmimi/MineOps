import { ValidationError } from '../domain/errors.js';

export class RequirementValidator {
  constructor({ runner, envProvider, configService }) {
    this.runner = runner;
    this.envProvider = envProvider;
    this.configService = configService;
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

  checkEnvironment() {
    const env = this.envProvider.load();
    const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID', 'PLAYIT_SECRET_KEY'];
    const missing = required.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new ValidationError(`Missing required .env values: ${missing.join(', ')}`);
    }
    return env;
  }

  checkConfiguration() {
    return this.configService.validate();
  }

  validate() {
    const os = this.checkOs();
    const commands = this.checkCommands();
    this.checkDocker();
    const env = this.checkEnvironment();
    this.checkConfiguration();
    return { os, commands, env };
  }
}
