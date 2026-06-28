function sanitizeInstanceSegment(name) {
  return String(name ?? 'default')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || 'default';
}

function clampKubernetesName(value) {
  return value.length <= 63 ? value : value.slice(0, 63);
}

export const platformResourceNames = Object.freeze({
  minecraftDeployment: 'minecraft',
  minecraftService: 'minecraft',
  minecraftPvc: 'minecraft-data',
  discordDeployment: 'discord-bot',
  playitDeployment: 'playit',
  backupCronJob: 'minecraft-backup',
  minecraftSelector: 'app.kubernetes.io/name=minecraft',
  backupSelector: 'app.kubernetes.io/name=minecraft-backup',
  instanceLabelKey: 'app.kubernetes.io/instance',
});

export function resourceNamesFor(instance) {
  const segment = sanitizeInstanceSegment(instance?.name);
  return {
    ...platformResourceNames,
    worldImportPod: clampKubernetesName(`mineops-world-import-${segment}`),
    restoreHelperPod: clampKubernetesName(`mineops-restore-helper-${segment}`),
  };
}
