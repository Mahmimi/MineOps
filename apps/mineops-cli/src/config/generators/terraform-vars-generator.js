function serviceConfig(instance, type) {
  return instance.service(type)?.config ?? {};
}

function instanceSuffix(instance) {
  return instance.name === 'default' ? '' : `-${instance.name}`;
}

function kubernetesNameSuffix(instance) {
  if (instance.name === 'default') return '';

  const normalized = instance.name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9]+$/, '');

  return normalized ? `-${normalized}` : '';
}

export function generateTerraformVars(mineopsConfig, instance = mineopsConfig.defaultInstance()) {
  const minecraft = serviceConfig(instance, 'minecraft');
  const playit = serviceConfig(instance, 'playit');
  const backup = serviceConfig(instance, 'backup');
  const env = mineopsConfig.globals.env;
  const suffix = instanceSuffix(instance);
  const kubernetesSuffix = kubernetesNameSuffix(instance);

  const operators = minecraft.operators ?? [];
  const storage = minecraft.storage ?? {};
  const resources = minecraft.resources ?? {};
  const requests = resources.requests ?? {};
  const limits = resources.limits ?? {};
  const backupHostPath = backup.hostPath ?? env.TF_VAR_backup_host_path ?? './backups';

  return {
    instance_name: instance.name,
    namespace: instance.namespace,
    mineops_time_zone: env.MINEOPS_TIME_ZONE,
    mineops_time_offset_seconds: Number.parseInt(env.MINEOPS_TIME_OFFSET_SECONDS, 10),
    minecraft_pv_name: `mineops-minecraft-data${kubernetesSuffix}`,
    minecraft_storage_size: storage.size,
    minecraft_host_path: storage.hostPath ?? `/var/lib/rancher/k3s/storage/mineops-minecraft-data${suffix}`,
    minecraft_type: minecraft.minecraft.type,
    minecraft_version: String(minecraft.minecraft.version),
    minecraft_memory: minecraft.server.memory,
    minecraft_online_mode: minecraft.server.onlineMode,
    minecraft_max_players: minecraft.server.maxPlayers,
    minecraft_spawn_protection: minecraft.server.spawnProtection ?? 16,
    minecraft_difficulty: minecraft.world.difficulty,
    minecraft_mode: minecraft.world.mode,
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
    backup_host_path: backupHostPath,
    backup_node_path: instance.name === 'default' ? '' : `/backups/${instance.name}`,
    playit_secret_value: playit.secretKey ?? env.TF_VAR_playit_secret_value,
    playit_replicas: Number.parseInt(env.TF_VAR_playit_replicas ?? '1', 10),
  };
}
