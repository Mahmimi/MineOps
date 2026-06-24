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

function formatDurationFromSeconds(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  }

  if (minutes > 0) {
    return `${minutes} minutes ago`;
  }

  return 'less than a minute ago';
}

function formatCronInterval(schedule) {
  const match = String(schedule).match(/^\*\/(\d+) \* \* \* \*$/);
  if (match) {
    const minutes = Number.parseInt(match[1], 10);
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }

  return schedule;
}

function podReady(pod) {
  return pod.status?.conditions?.some((condition) => condition.type === 'Ready' && condition.status === 'True') ?? false;
}

function jobCondition(job, type) {
  return job.status?.conditions?.some((condition) => condition.type === type && condition.status === 'True') ?? false;
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
    this.batchApi = this.kubeConfig.makeApiClient(k8s.BatchV1Api);
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

  async listBackupJobs() {
    const response = await this.batchApi.listNamespacedJob({
      namespace: this.config.mineops.namespace,
      labelSelector: this.config.mineops.backupLabelSelector,
    });
    return response.items ?? [];
  }

  async getBackupCronJob() {
    return this.batchApi.readNamespacedCronJob({
      namespace: this.config.mineops.namespace,
      name: this.config.mineops.backupCronJobName,
    });
  }

  async getBackupInfo() {
    try {
      const [cronJob, jobs] = await Promise.all([
        this.getBackupCronJob(),
        this.listBackupJobs(),
      ]);

      const completedJobs = jobs
        .filter((job) => jobCondition(job, 'Complete'))
        .map((job) => ({
          name: job.metadata?.name ?? 'unknown',
          startTime: job.status?.startTime ?? null,
          completionTime: job.status?.completionTime ?? null,
        }))
        .filter((job) => job.completionTime)
        .sort((a, b) => new Date(b.completionTime).getTime() - new Date(a.completionTime).getTime());

      const latestJob = jobs
        .map((job) => ({
          name: job.metadata?.name ?? 'unknown',
          startTime: job.status?.startTime ?? null,
          completionTime: job.status?.completionTime ?? null,
          failed: jobCondition(job, 'Failed'),
          complete: jobCondition(job, 'Complete'),
          failedCount: job.status?.failed ?? 0,
        }))
        .sort((a, b) => new Date(b.completionTime ?? b.startTime ?? 0).getTime() - new Date(a.completionTime ?? a.startTime ?? 0).getTime())[0] ?? null;

      const container = cronJob.spec?.jobTemplate?.spec?.template?.spec?.containers?.find(
        (item) => item.name === 'minecraft-backup',
      );
      const lastBackupAt = completedJobs[0]?.completionTime ?? null;
      const ageSeconds = lastBackupAt
        ? Math.max(0, Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 1000))
        : null;

      return {
        available: true,
        lastBackupAt,
        lastBackupAge: ageSeconds === null ? null : formatDurationFromSeconds(ageSeconds),
        stale: ageSeconds === null ? false : ageSeconds > 7200,
        mode: containerEnv(container, 'BACKUP_MODE') ?? 'unknown',
        schedule: cronJob.spec?.schedule ?? 'unknown',
        interval: formatCronInterval(cronJob.spec?.schedule ?? 'unknown'),
        latestJob,
        lastDurationSeconds: completedJobs[0]?.startTime
          ? Math.max(0, Math.round((new Date(completedJobs[0].completionTime).getTime() - new Date(completedJobs[0].startTime).getTime()) / 1000))
          : null,
      };
    } catch (error) {
      this.logger.warn('backup info unavailable', { error: error.message });
      return {
        available: false,
        lastBackupAt: null,
        lastBackupAge: null,
        stale: false,
        mode: 'unknown',
        schedule: 'unknown',
        interval: 'unknown',
        latestJob: null,
        lastDurationSeconds: null,
      };
    }
  }

  async getStatus() {
    const [deployment, pods] = await Promise.all([
      this.getMinecraftDeployment(),
      this.listMinecraftPods(),
    ]);

    const primaryPod = pods[0] ?? null;
    const availableCondition = deployment.status?.conditions?.find((condition) => condition.type === 'Available');
    return {
      namespace: this.config.mineops.namespace,
      deployment: deployment.metadata?.name ?? this.config.mineops.minecraftDeploymentName,
      desiredReplicas: deployment.spec?.replicas ?? 0,
      readyReplicas: deployment.status?.readyReplicas ?? 0,
      availableReplicas: deployment.status?.availableReplicas ?? 0,
      running: (deployment.status?.readyReplicas ?? 0) > 0,
      lastSeen: availableCondition?.lastTransitionTime ? formatDuration(availableCondition.lastTransitionTime) : null,
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
