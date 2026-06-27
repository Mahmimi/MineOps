import { deepFreeze } from './immutability.js';

export class PlatformServiceConfig {
  constructor({ type, name = type, enabled = true, config = {} }) {
    this.type = type;
    this.name = name;
    this.enabled = enabled;
    this.config = deepFreeze({ ...config });

    deepFreeze(this);
  }
}

