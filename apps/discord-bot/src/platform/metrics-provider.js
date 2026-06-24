export class MetricsProvider {
  async getSnapshot() {
    throw new Error('MetricsProvider.getSnapshot must be implemented');
  }
}

export class KubernetesMetricsProvider extends MetricsProvider {
  constructor({ platformService }) {
    super();
    this.platformService = platformService;
  }

  async getSnapshot() {
    return this.platformService.getStatus();
  }
}
