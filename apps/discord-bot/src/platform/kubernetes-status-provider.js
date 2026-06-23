import * as k8s from '@kubernetes/client-node';

function containerEnv(container, name) {
  return container?.env?.find((item) => item.name === name)?.value ?? null;
}

function formatDuration(startTime) {
  if (!startTime) return null;
  const started = new Date(startTime).getTime();
  if (Number.isNaN(started)) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours}h ${minutes}m ${remainingSeconds}s`;
}

function podReady(pod) {
  return pod.status?.conditions?.some((condition) => condition.type === 'Ready' && condition.status === 'True') ?? false;
}

export class KubernetesStatusProvider {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.kubeConfig = new k8s.KubeConfig();

    if (process.env.KUBERNETES_SERVICE_HOST) {
      this.kubeConfig.loadFromCluster();
    } else {
      this.kubeConfig.loadFromDefault();
    }

    this.coreApi = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.appsApi = this.kubeConfig.makeApiClient(k8s.AppsV1Api);
  }

  async getMinecraftDeployment() {
    return this.appsApi.readNamespacedDeployment({
      namespace: this.config.mineops.namespace,
      name: this.config.mineops.minecraftDeploymentName,
    });
  }

  async listMinecraftPods() {
    const response = await this.coreApi.listNamespacedPod({
      namespace: this.config.mineops.namespace,
      labelSelector: this.config.mineops.minecraftLabelSelector,
    });
    return response.items ?? [];
  }

  async getMinecraftService() {
    return this.coreApi.readNamespacedService({
      namespace: this.config.mineops.namespace,
      name: this.config.mineops.minecraftServiceName,
    });
  }

  async getStatus() {
    const [deployment, pods] = await Promise.all([
      this.getMinecraftDeployment(),
      this.listMinecraftPods(),
    ]);

    const primaryPod = pods[0] ?? null;
    return {
      namespace: this.config.mineops.namespace,
      deployment: deployment.metadata?.name ?? this.config.mineops.minecraftDeploymentName,
      desiredReplicas: deployment.spec?.replicas ?? 0,
      readyReplicas: deployment.status?.readyReplicas ?? 0,
      availableReplicas: deployment.status?.availableReplicas ?? 0,
      running: (deployment.status?.readyReplicas ?? 0) > 0,
      pods: pods.map((pod) => ({
        name: pod.metadata?.name ?? 'unknown',
        phase: pod.status?.phase ?? 'Unknown',
        ready: podReady(pod),
        nodeName: pod.spec?.nodeName ?? null,
        startTime: pod.status?.startTime ?? null,
        uptime: formatDuration(pod.status?.startTime),
      })),
      primaryPod: primaryPod
        ? {
            name: primaryPod.metadata?.name ?? 'unknown',
            phase: primaryPod.status?.phase ?? 'Unknown',
            ready: podReady(primaryPod),
            uptime: formatDuration(primaryPod.status?.startTime),
          }
        : null,
    };
  }

  async getServer() {
    const [deployment, service] = await Promise.all([
      this.getMinecraftDeployment(),
      this.getMinecraftService(),
    ]);

    const container = deployment.spec?.template?.spec?.containers?.find(
      (item) => item.name === this.config.mineops.minecraftContainerName,
    );
    const servicePort = service.spec?.ports?.[0];
    const loadBalancerIngress = service.status?.loadBalancer?.ingress ?? [];

    return {
      namespace: this.config.mineops.namespace,
      deployment: deployment.metadata?.name ?? this.config.mineops.minecraftDeploymentName,
      image: container?.image ?? 'unknown',
      serverType: containerEnv(container, 'TYPE') ?? 'unknown',
      version: containerEnv(container, 'VERSION') ?? 'unknown',
      memory: containerEnv(container, 'MEMORY') ?? 'unknown',
      mode: containerEnv(container, 'MODE') ?? 'unknown',
      difficulty: containerEnv(container, 'DIFFICULTY') ?? 'unknown',
      worldSeedConfigured: containerEnv(container, 'SEED') ? true : false,
      service: {
        name: service.metadata?.name ?? this.config.mineops.minecraftServiceName,
        type: service.spec?.type ?? 'unknown',
        port: servicePort?.port ?? null,
        targetPort: servicePort?.targetPort ?? null,
        nodePort: servicePort?.nodePort ?? null,
        ingress: loadBalancerIngress.map((item) => item.ip ?? item.hostname).filter(Boolean),
      },
      world: {
        name: 'world',
        source: 'default Minecraft world directory; detailed world metadata is not exposed by the read-only bot',
      },
    };
  }
}
