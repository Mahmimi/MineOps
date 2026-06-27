export class KubernetesAdapter {
  constructor({ runner, namespace }) {
    this.runner = runner;
    this.namespace = namespace;
  }

  json(args, { fallback = null } = {}) {
    const result = this.runner.run('kubectl', [...args, '-o', 'json'], { capture: true, allowFailure: true });
    if (result.status !== 0) return fallback;
    return JSON.parse(result.stdout);
  }

  getDeployment(name, namespace = this.namespace) {
    return this.json(['get', 'deployment', name, '-n', namespace]);
  }

  deploymentState(name, namespace = this.namespace) {
    const deploy = this.getDeployment(name, namespace);
    if (!deploy) return { state: 'MISSING', ready: 0, desired: 0 };
    const desired = deploy.spec?.replicas ?? 0;
    const ready = deploy.status?.readyReplicas ?? 0;
    const available = deploy.status?.availableReplicas ?? 0;
    if (desired === 0) return { state: 'SCALED TO 0', ready, desired, available };
    return { state: ready >= desired && available >= desired ? 'ONLINE' : 'DEGRADED', ready, desired, available };
  }

  endpointCount(name, namespace = this.namespace) {
    const endpoints = this.json(['get', 'endpoints', name, '-n', namespace], { fallback: null });
    return (endpoints?.subsets ?? [])
      .flatMap((subset) => subset.addresses ?? [])
      .length;
  }

  playitState(namespace = this.namespace) {
    const agent = this.deploymentState('playit', namespace);
    const minecraftEndpointCount = this.endpointCount('minecraft', namespace);
    const minecraftEndpointsReady = minecraftEndpointCount > 0;
    return {
      ...agent,
      agentReady: agent.state === 'ONLINE',
      minecraftEndpointCount,
      minecraftEndpointsReady,
      publicReady: agent.state === 'ONLINE' && minecraftEndpointsReady,
      reason: agent.state === 'ONLINE'
        ? minecraftEndpointsReady
          ? 'Playit agent is ready and Minecraft has service endpoints.'
          : 'Playit agent is ready, but Minecraft has no service endpoints.'
        : 'Playit agent deployment is not ready.',
    };
  }

  podFor(labelSelector) {
    return this.json(['get', 'pods', '-n', this.namespace, '-l', labelSelector], { fallback: { items: [] } })?.items?.[0] ?? null;
  }

  nodes() {
    return this.json(['get', 'nodes'], { fallback: { items: [] } })?.items ?? [];
  }

  backupJobs() {
    return this.json(['get', 'jobs', '-n', this.namespace, '-l', 'app.kubernetes.io/name=minecraft-backup'], { fallback: { items: [] } })?.items ?? [];
  }

  cronJob(name, namespace = this.namespace) {
    return this.json(['get', 'cronjob', name, '-n', namespace]);
  }

  pvc(name, namespace = this.namespace) {
    return this.json(['get', 'pvc', name, '-n', namespace]);
  }

  service(name, namespace = this.namespace) {
    return this.json(['get', 'service', name, '-n', namespace]);
  }

  secret(name, namespace = this.namespace) {
    return this.json(['get', 'secret', name, '-n', namespace]);
  }
}
