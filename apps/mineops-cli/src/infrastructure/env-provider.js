import path from 'node:path';

export class EnvProvider {
  constructor({ root, envPath = process.env.MINEOPS_ENV_PATH || null }) {
    this.root = root;
    this.envPath = envPath ? path.resolve(root, envPath) : this.resolve('.env');
  }

  resolve(...parts) {
    return path.join(this.root, ...parts);
  }
}