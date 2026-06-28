import fs from 'node:fs';
import path from 'node:path';
import { resourceNamesFor } from '../domain/resource-names.js';

export class BackupService {
  constructor({ root, kubernetes, getMineOpsConfig }) {
    this.root = root;
    this.kubernetes = kubernetes;
    this.getMineOpsConfig = getMineOpsConfig;
  }


  backupNodePath(instance) {
    return instance.name === 'default' ? '/backups' : `/backups/${instance.name}`;
  }

  backupRoot(instance) {
    const mineopsConfig = this.getMineOpsConfig();
    const backupConfig = instance.service('backup')?.config ?? {};
    const hostPath = backupConfig.hostPath
      ?? mineopsConfig.globals.env.MINEOPS_BACKUP_HOST_PATH
      ?? mineopsConfig.globals.env.TF_VAR_backup_host_path
      ?? './backups';
    const resolved = path.isAbsolute(hostPath) ? hostPath : path.resolve(this.root, hostPath);
    return instance.name === 'default' ? resolved : path.join(resolved, instance.name);
  }

  jobs(instance) {
    return this.kubernetes.backupJobs(instance).map((job) => ({
      name: job.metadata?.name ?? 'unknown',
      complete: job.status?.conditions?.some((condition) => condition.type === 'Complete' && condition.status === 'True') ?? false,
      failed: job.status?.conditions?.some((condition) => condition.type === 'Failed' && condition.status === 'True') ?? false,
      completionTime: job.status?.completionTime ?? null,
      startTime: job.status?.startTime ?? null,
    }));
  }

  latestJob(instance) {
    return this.jobs(instance).sort((a, b) => new Date(b.completionTime ?? b.startTime ?? 0) - new Date(a.completionTime ?? a.startTime ?? 0))[0] ?? null;
  }

  config(instance) {
    const names = resourceNamesFor(instance);
    const cron = this.kubernetes.cronJob(names.backupCronJob, instance);
    const env = cron?.spec?.jobTemplate?.spec?.template?.spec?.containers?.[0]?.env ?? [];
    const value = (name) => env.find((item) => item.name === name)?.value ?? 'unknown';
    return {
      mode: value('BACKUP_MODE'),
      limit: value('BACKUP_LIMIT'),
      schedule: cron?.spec?.schedule ?? 'unknown',
      interval: this.formatCron(cron?.spec?.schedule ?? 'unknown'),
    };
  }

  listBackups(instance) {
    const root = this.backupRoot(instance);
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && (/^backup_\d{4}-\d{2}-\d{2}_\d{1,2}-\d{2}-\d{2}$/.test(entry.name) || /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(entry.name) || entry.name === 'latest'))
      .map((entry) => {
        const fullPath = path.join(root, entry.name);
        const stat = fs.statSync(fullPath);
        return { name: entry.name, path: fullPath, createdAt: stat.mtime, sizeBytes: this.dirSize(fullPath), status: 'SUCCESS' };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  dirSize(target) {
    let total = 0;
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      const full = path.join(target, entry.name);
      total += entry.isDirectory() ? this.dirSize(full) : fs.statSync(full).size;
    }
    return total;
  }

  formatCron(schedule) {
    const match = String(schedule).match(/^\*\/(\d+) \* \* \* \*$/);
    return match ? `${match[1]}m` : schedule;
  }
}