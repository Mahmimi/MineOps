function serviceConfig(instance, type) {
  return instance.service(type)?.config ?? {};
}

export function generateTerraformVars(mineopsConfig) {
  const instance = mineopsConfig.defaultInstance();
  const minecraft = serviceConfig(instance, 'minecraft');
  const playit = serviceConfig(instance, 'playit');
  const backup = serviceConfig(instance, 'backup');
  const env = mineopsConfig.globals.env;

  const operators = minecraft.operators ?? [];
  const storage = minecraft.storage ?? {};
  const resources = minecraft.resources ?? {};
  const requests = resources.requests ?? {};
  const limits = resources.limits ?? {};

  return {
    namespace: instance.namespace,
    mineops_time_zone: env.MINEOPS_TIME_ZONE,
    mineops_time_offset_seconds: Number.parseInt(env.MINEOPS_TIME_OFFSET_SECONDS, 10),
    minecraft_storage_size: storage.size,
    minecraft_host_path: storage.hostPath ?? '/var/lib/rancher/k3s/storage/mineops-minecraft-data',
    minecraft_type: minecraft.minecraft.type,
    minecraft_version: String(minecraft.minecraft.version),
    minecraft_memory: minecraft.server.memory,
    minecraft_ops: operators.length > 0 ? operators.join(',') : 'Jiranuwat',
    minecraft_seed: String(minecraft.world.seed ?? '5063885805507972583'),
    minecraft_cpu_request: requests.cpu,
    minecraft_memory_request: requests.memory,
    minecraft_cpu_limit: limits.cpu,
    minecraft_memory_limit: limits.memory,
    backup_enabled: backup.settings.enabled,
    backup_schedule: backup.settings.interval,
    backup_mode: backup.settings.mode,
    backup_limit: backup.settings.limit ?? 5,
    backup_host_path: env.MINEOPS_BACKUP_HOST_PATH,
    playit_secret_value: playit.secretKey,
    playit_replicas: 1,
  };
}

