import { deepFreeze } from './immutability.js';
import { InstanceConfig } from './instance-config.js';

export class MineOpsConfig {
  constructor({
    apiVersion = 'mineops.internal/v1',
    source = 'unknown',
    cluster = {},
    globals = {},
    instances = [],
  }) {
    this.apiVersion = apiVersion;
    this.source = source;
    this.cluster = deepFreeze({ ...cluster });
    this.globals = deepFreeze({ ...globals });
    this.instances = deepFreeze(instances.map((instance) => (
      instance instanceof InstanceConfig ? instance : new InstanceConfig(instance)
    )));

    deepFreeze(this);
  }

  defaultInstance() {
    return this.instances[0] ?? null;
  }
}

