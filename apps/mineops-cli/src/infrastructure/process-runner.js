import { spawnSync } from 'node:child_process';
import { PlatformError } from '../domain/errors.js';

export class ProcessRunner {
  constructor({ cwd, envProvider }) {
    this.cwd = cwd;
    this.envProvider = envProvider;
  }

  run(command, args = [], options = {}) {
    const result = spawnSync(command, args, {
      cwd: options.cwd ?? this.cwd,
      env: { ...process.env, ...this.envProvider.load({ optional: true }), ...(options.env ?? {}) },
      encoding: 'utf8',
      shell: false,
      stdio: options.capture || options.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });

    if (result.error) {
      if (options.allowFailure) return result;
      throw new PlatformError(`${command} failed to start`, { cause: result.error });
    }

    if (result.status !== 0 && !options.allowFailure) {
      throw new PlatformError(`${command} ${args.join(' ')} failed`, { cause: result.stderr || result.stdout });
    }

    return result;
  }

  capture(command, args = [], options = {}) {
    return this.run(command, args, { ...options, capture: true }).stdout.trim();
  }

  hasCommand(command) {
    const result = process.platform === 'win32'
      ? this.run('where.exe', [command], { capture: true, allowFailure: true })
      : this.run('which', [command], { capture: true, allowFailure: true });
    return result.status === 0;
  }
}
