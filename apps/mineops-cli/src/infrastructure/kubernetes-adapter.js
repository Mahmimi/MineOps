import { resourceNamesFor } from '../domain/resource-names.js';

export class KubernetesAdapter {
  constructor({ runner }) {
    this.runner = runner;
  }

  namespaceOf(target) {
    return typeof target === 'string' ? target : target?.namespace;
  }

  namesOf(target) {
    return resourceNamesFor(typeof target === 'string' ? null : target);
  }

  json(args, { fallback = null } = {}) {
    const result = this.runner.run('kubectl', [...args, '-o', 'json'], { capture: true, allowFailure: true });
    if (result.status !== 0) return fallback;
    return JSON.parse(result.stdout);
  }

  getDeployment(name, target) {
    return this.json(['get', 'deployment', name, '-n', this.namespaceOf(target)]);
  }

  deploymentState(name, target) {
    const deploy = this.getDeployment(name, target);
    if (!deploy) return { state: 'MISSING', ready: 0, desired: 0 };
    const desired = deploy.spec?.replicas ?? 0;
    const ready = deploy.status?.readyReplicas ?? 0;
    const available = deploy.status?.availableReplicas ?? 0;
    if (desired === 0) return { state: 'SCALED TO 0', ready, desired, available };
    return { state: ready >= desired && available >= desired ? 'ONLINE' : 'DEGRADED', ready, desired, available };
  }

  endpointCount(name, target) {
    const endpoints = this.json(['get', 'endpoints', name, '-n', this.namespaceOf(target)], { fallback: null });
    return (endpoints?.subsets ?? []).flatMap((subset) => subset.addresses ?? []).length;
  }

  playitState(target) {
    const names = this.namesOf(target);
    const agent = this.deploymentState(names.playitDeployment, target);
    const minecraftEndpointCount = this.endpointCount(names.minecraftService, target);
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

  podFor(labelSelector, target) {
    return this.json(['get', 'pods', '-n', this.namespaceOf(target), '-l', labelSelector], { fallback: { items: [] } })?.items?.[0] ?? null;
  }

  nodes() {
    return this.json(['get', 'nodes'], { fallback: { items: [] } })?.items ?? [];
  }

  backupJobs(target) {
    const names = this.namesOf(target);
    return this.json(['get', 'jobs', '-n', this.namespaceOf(target), '-l', names.backupSelector], { fallback: { items: [] } })?.items ?? [];
  }

  cronJob(name, target) {
    return this.json(['get', 'cronjob', name, '-n', this.namespaceOf(target)]);
  }

  pvc(name, target) {
    return this.json(['get', 'pvc', name, '-n', this.namespaceOf(target)]);
  }

  service(name, target) {
    return this.json(['get', 'service', name, '-n', this.namespaceOf(target)]);
  }

  secret(name, target) {
    return this.json(['get', 'secret', name, '-n', this.namespaceOf(target)]);
  }
}
