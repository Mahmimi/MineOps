import * as k8s from '@kubernetes/client-node';
import stream from 'node:stream';
import { localTimestamp } from '../../../utils/time.js';

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
  if (hours > 0) return `${hours}h ${minutes}m ago`;
  if (minutes > 0) return `${minutes} minutes ago`;
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

function deploymentState(deployment) {
  const desired = deployment.spec?.replicas ?? 0;
  const ready = deployment.status?.readyReplicas ?? 0;
  const available = deployment.status?.availableReplicas ?? 0;
  if (desired === 0) return 'SCALED_TO_0';
  return ready >= desired && available >= desired ? 'ONLINE' : 'DEGRADED';
}

function endpointCount(endpoints) {
  return (endpoints.subsets ?? [])
    .flatMap((subset) => subset.addresses ?? [])
    .length;
}

function jobCondition(job, type) {
  return job.status?.conditions?.some((condition) => condition.type === type && condition.status === 'True') ?? false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class KubernetesStatusProvider {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.kubeConfig = new k8s.KubeConfig();

    if (process.env.KUBERNETES_SERVICE_HOST) this.kubeConfig.loadFromCluster();
    else this.kubeConfig.loadFromDefault();

    this.coreApi = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.appsApi = this.kubeConfig.makeApiClient(k8s.AppsV1Api);
    this.batchApi = this.kubeConfig.makeApiClient(k8s.BatchV1Api);
    this.execClient = new k8s.Exec(this.kubeConfig);
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

  async getMinecraftEndpoints() {
    return this.coreApi.readNamespacedEndpoints({
      namespace: this.config.mineops.namespace,
      name: this.config.mineops.minecraftServiceName,
    });
  }

  async getPlayitDeployment() {
    return this.appsApi.readNamespacedDeployment({
      namespace: this.config.mineops.namespace,
      name: this.config.mineops.playitDeploymentName,
    });
  }

  async listPlayitPods() {
    const response = await this.coreApi.listNamespacedPod({
      namespace: this.config.mineops.namespace,
      labelSelector: this.config.mineops.playitLabelSelector,
    });
    return response.items ?? [];
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

  async setBackupCronJobSuspended(suspend) {
    const cronJob = await this.getBackupCronJob();
    cronJob.spec = { ...(cronJob.spec ?? {}), suspend };
    return this.batchApi.replaceNamespacedCronJob({
      namespace: this.config.mineops.namespace,
      name: this.config.mineops.backupCronJobName,
      body: cronJob,
    });
  }

  async getBackupInfo() {
    try {
      const [cronJob, jobs] = await Promise.all([this.getBackupCronJob(), this.listBackupJobs()]);
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

      const activeJobs = jobs
        .filter((job) => (job.status?.active ?? 0) > 0)
        .map((job) => ({ name: job.metadata?.name ?? 'unknown', startTime: job.status?.startTime ?? null }));

      const container = cronJob.spec?.jobTemplate?.spec?.template?.spec?.containers?.find((item) => item.name === 'minecraft-backup');
      const lastBackupAt = completedJobs[0]?.completionTime ?? null;
      const ageSeconds = lastBackupAt ? Math.max(0, Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 1000)) : null;

      return {
        available: true,
        lastBackupAt,
        lastBackupAge: ageSeconds === null ? null : formatDurationFromSeconds(ageSeconds),
        stale: ageSeconds === null ? false : ageSeconds > 7200,
        mode: containerEnv(container, 'BACKUP_MODE') ?? 'unknown',
        retentionLimit: containerEnv(container, 'BACKUP_LIMIT') ?? 'unknown',
        schedule: cronJob.spec?.schedule ?? 'unknown',
        interval: formatCronInterval(cronJob.spec?.schedule ?? 'unknown'),
        suspended: cronJob.spec?.suspend === true,
        latestJob,
        activeJobs,
        backupRunning: activeJobs.length > 0,
        recentJobs: completedJobs.slice(0, 5),
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
        suspended: false,
        latestJob: null,
        activeJobs: [],
        backupRunning: false,
        recentJobs: [],
        lastDurationSeconds: null,
      };
    }
  }

  async getStatus() {
    const [deployment, pods, playit] = await Promise.all([this.getMinecraftDeployment(), this.listMinecraftPods(), this.getPlayitStatus()]);
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
      playit,
    };
  }

  async getPlayitStatus() {
    try {
      const [deployment, pods, minecraftEndpoints] = await Promise.all([
        this.getPlayitDeployment(),
        this.listPlayitPods(),
        this.getMinecraftEndpoints(),
      ]);
      const primaryPod = pods[0] ?? null;
      const desiredReplicas = deployment.spec?.replicas ?? 0;
      const readyReplicas = deployment.status?.readyReplicas ?? 0;
      const endpointsReady = endpointCount(minecraftEndpoints) > 0;
      const agentReady = desiredReplicas > 0 && readyReplicas >= desiredReplicas;

      return {
        available: true,
        deployment: deployment.metadata?.name ?? this.config.mineops.playitDeploymentName,
        state: deploymentState(deployment),
        desiredReplicas,
        readyReplicas,
        availableReplicas: deployment.status?.availableReplicas ?? 0,
        agentReady,
        minecraftEndpointsReady: endpointsReady,
        minecraftEndpointCount: endpointCount(minecraftEndpoints),
        publicJoinAddress: this.config.mineops.playitJoinAddress || null,
        health: agentReady && endpointsReady ? 'READY' : 'DEGRADED',
        reason: agentReady
          ? endpointsReady
            ? 'Playit agent is ready and Minecraft has service endpoints.'
            : 'Playit agent is ready, but Minecraft has no service endpoints.'
          : 'Playit agent deployment is not ready.',
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
    } catch (error) {
      this.logger.warn('playit status unavailable', { error: error.message });
      return {
        available: false,
        deployment: this.config.mineops.playitDeploymentName,
        state: 'UNKNOWN',
        desiredReplicas: 0,
        readyReplicas: 0,
        availableReplicas: 0,
        agentReady: false,
        minecraftEndpointsReady: false,
        minecraftEndpointCount: 0,
        publicJoinAddress: this.config.mineops.playitJoinAddress || null,
        health: 'UNKNOWN',
        reason: 'Playit status is unavailable.',
        pods: [],
        primaryPod: null,
      };
    }
  }

  async getServer() {
    const [deployment, service] = await Promise.all([this.getMinecraftDeployment(), this.getMinecraftService()]);
    const container = deployment.spec?.template?.spec?.containers?.find((item) => item.name === this.config.mineops.minecraftContainerName);
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
      worldSeedConfigured: Boolean(containerEnv(container, 'SEED')),
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
        source: 'default Minecraft world directory; detailed world metadata is not exposed by the bot',
      },
    };
  }

  async scaleMinecraft(replicas) {
    const scale = await this.appsApi.readNamespacedDeploymentScale({
      namespace: this.config.mineops.namespace,
      name: this.config.mineops.minecraftDeploymentName,
    });
    scale.spec = { ...(scale.spec ?? {}), replicas };
    return this.appsApi.replaceNamespacedDeploymentScale({
      namespace: this.config.mineops.namespace,
      name: this.config.mineops.minecraftDeploymentName,
      body: scale,
    });
  }

  async restartMinecraft() {
    const deployment = await this.getMinecraftDeployment();
    deployment.spec.template.metadata = deployment.spec.template.metadata ?? {};
    deployment.spec.template.metadata.annotations = {
      ...(deployment.spec.template.metadata.annotations ?? {}),
      'kubectl.kubernetes.io/restartedAt': localTimestamp(),
    };
    return this.appsApi.replaceNamespacedDeployment({
      namespace: this.config.mineops.namespace,
      name: this.config.mineops.minecraftDeploymentName,
      body: deployment,
    });
  }

  async waitForMinecraftReady({ timeoutMs = 180000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = await this.getStatus();
      if (status.readyReplicas >= 1 && status.primaryPod?.ready) return status;
      await delay(3000);
    }
    throw new Error('Minecraft did not become ready before timeout');
  }

  async waitForMinecraftStopped({ timeoutMs = 180000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = await this.getStatus();
      if ((status.desiredReplicas ?? 0) === 0 && (status.readyReplicas ?? 0) === 0) return status;
      await delay(3000);
    }
    throw new Error('Minecraft did not stop before timeout');
  }

  async execMinecraftConsole(command) {
    const pods = await this.listMinecraftPods();
    const pod = pods.find((item) => podReady(item)) ?? pods[0];
    if (!pod?.metadata?.name) throw new Error('Minecraft pod is not available');

    let stdout = '';
    let stderr = '';
    let failed = false;
    const out = new stream.Writable({
      write(chunk, _encoding, callback) {
        stdout += chunk.toString();
        callback();
      },
    });
    const err = new stream.Writable({
      write(chunk, _encoding, callback) {
        stderr += chunk.toString();
        callback();
      },
    });

    await this.execClient.exec(
      this.config.mineops.namespace,
      pod.metadata.name,
      this.config.mineops.minecraftContainerName,
      ['gosu', 'minecraft', 'mc-send-to-console', command],
      out,
      err,
      null,
      false,
      (status) => {
        failed = status.status !== 'Success';
      },
    );

    if (failed) throw new Error(stderr || stdout || `Minecraft command failed: ${command}`);
    return { stdout, stderr };
  }
}
