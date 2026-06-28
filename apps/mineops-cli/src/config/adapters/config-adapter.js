export class ConfigAdapter {
  constructor({ source }) {
    this.source = source;
  }

  detect() {
    return true;
  }

  loadRaw() {
    throw new Error('ConfigAdapter.loadRaw() must be implemented by subclasses.');
  }
}

