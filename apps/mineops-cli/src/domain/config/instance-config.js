import { deepFreeze } from './immutability.js';
import { PlatformServiceConfig } from './platform-service-config.js';

export class InstanceConfig {
  constructor({
    name,
    namespace,
    enabled = true,
    labels = {},
    services = [],
    legacy = {},
  }) {
    this.name = name;
    this.namespace = namespace;
    this.enabled = enabled;
    this.labels = deepFreeze({ ...labels });
    this.services = deepFreeze(services.map((service) => (
      service instanceof PlatformServiceConfig ? service : new PlatformServiceConfig(service)
    )));
    this.legacy = deepFreeze({ ...legacy });

    deepFreeze(this);
  }

  service(type) {
    return this.services.find((service) => service.type === type) ?? null;
  }
}

