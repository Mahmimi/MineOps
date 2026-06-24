#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const NS = 'mineops';
const CLUSTER = 'mineops-local';
const VERSION = '0.5.2';
const BOT_IMAGE = 'mineops-discord-bot:phase5.2';
const DATA_DIR = '/app/data';
const LINE = '────────────────────────────────────────';
const ASCII_LINE = '----------------------------------------';
const ICONS = process.env.MINEOPS_ASCII === '1' ? {
  ok: '[OK]', warn: '[WARN]', fail: '[FAIL]', dot: '*', box: '#', clock: 'Time', wrench: 'Maintenance', disk: 'Storage', bot: 'Bot', game: 'Minecraft', players: 'Players', backup: 'Backup', cluster: 'Cluster', spark: '*', info: '[INFO]'
} : {
  ok: '✅', warn: '⚠️', fail: '❌', dot: '●', box: '▣', clock: '⏱', wrench: '🛠', disk: '💾', bot: '🤖', game: '🎮', players: '👥', backup: '📦', cluster: '☸', spark: '✨', info: 'ℹ️'
};

function rel(...parts) { return path.join(ROOT, ...parts); }
function print(message = '') { process.stdout.write(`${message}\n`); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function line() { return process.env.MINEOPS_ASCII === '1' ? ASCII_LINE : LINE; }
function header(title) { print(line()); print(` ${title}`); print(line()); print(''); }
function footer(message) { print(''); print(line()); print(message); print(line()); }
function ok(label) { print(`${ICONS.ok} ${label}`); }
function warn(label) { print(`${ICONS.warn} ${label}`); }
function fail(label) { print(`${ICONS.fail} ${label}`); }
function color(code, value) { return process.stdout.isTTY ? `\u001b[${code}m${value}\u001b[0m` : value; }
function green(value) { return color(32, value); }
function yellow(value) { return color(33, value); }
function red(value) { return color(31, value); }
function cyan(value) { return color(36, value); }

function loadDotEnv({ optional = false } = {}) {
  const envPath = rel('.env');
  if (!fs.existsSync(envPath)) {
    if (optional) return defaultEnvPaths({});
    throw new Error('.env was not found. Copy .env.example to .env and fill required values.');
  }
  const values = {};
  for (const lineText of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = lineText.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return defaultEnvPaths(values);
}

function defaultEnvPaths(values) {
  values.MINEOPS_STORAGE_PATH ||= '.local/k3d/storage';
  values.MINEOPS_BACKUP_HOST_PATH ||= './backups';
  for (const key of ['MINEOPS_STORAGE_PATH', 'MINEOPS_BACKUP_HOST_PATH']) {
    if (values[key] && !path.isAbsolute(values[key])) values[key] = rel(values[key]);
  }
  return values;
}

function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: { ...process.env, ...loadDotEnv({ optional: true }) },
    encoding: 'utf8',
    shell: false,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) {
    if (options.allowFailure) return result;
    throw new Error(`${command} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture ? `\n${result.stderr || result.stdout}` : '';
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}${detail}`);
  }
  return result;
}
function runCapture(command, args = [], options = {}) { return run(command, args, { ...options, capture: true }).stdout.trim(); }
function hasCommand(command) {
  const check = process.platform === 'win32' ? run('where.exe', [command], { capture: true, allowFailure: true }) : run('which', [command], { capture: true, allowFailure: true });
  return check.status === 0;
}
function kubectlJson(args, options = {}) {
  const result = run('kubectl', [...args, '-o', 'json'], { capture: true, allowFailure: true });
  if (result.status !== 0) return options.fallback ?? null;
  return JSON.parse(result.stdout);
}
function botExec(script, { allowFailure = true } = {}) {
  return run('kubectl', ['exec', '-n', NS, 'deployment/discord-bot', '--', 'sh', '-lc', script], { capture: true, allowFailure });
}
function powershellArgs(script, args = []) { return ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', rel('scripts', script), ...args]; }

function terraformPlanClean() {
  return run('terraform', ['plan', '-detailed-exitcode'], { cwd: rel('infra', 'terraform'), capture: true, allowFailure: true }).status === 0;
}
function deploymentState(name) {
  const deploy = kubectlJson(['get', 'deployment', name, '-n', NS], { fallback: null });
  if (!deploy) return { state: 'MISSING', ready: 0, desired: 0 };
  const desired = deploy.spec?.replicas ?? 0;
  const ready = deploy.status?.readyReplicas ?? 0;
  const available = deploy.status?.availableReplicas ?? 0;
  if (desired === 0) return { state: 'SCALED TO 0', ready, desired, available };
  return { state: ready >= desired && available >= desired ? 'ONLINE' : 'DEGRADED', ready, desired, available };
}
function podFor(labelSelector) { return kubectlJson(['get', 'pods', '-n', NS, '-l', labelSelector], { fallback: { items: [] } })?.items?.[0] ?? null; }
function jobs() { return kubectlJson(['get', 'jobs', '-n', NS, '-l', 'app.kubernetes.io/name=minecraft-backup'], { fallback: { items: [] } })?.items ?? []; }
function latestBackupJob() {
  return jobs().map(jobToSummary).sort((a, b) => new Date(b.completionTime ?? b.startTime ?? 0) - new Date(a.completionTime ?? a.startTime ?? 0))[0] ?? null;
}
function jobToSummary(job) {
  return {
    name: job.metadata?.name ?? 'unknown',
    complete: job.status?.conditions?.some((condition) => condition.type === 'Complete' && condition.status === 'True') ?? false,
    failed: job.status?.conditions?.some((condition) => condition.type === 'Failed' && condition.status === 'True') ?? false,
    completionTime: job.status?.completionTime ?? null,
    startTime: job.status?.startTime ?? null,
  };
}
function backupConfig() {
  const cron = kubectlJson(['get', 'cronjob', 'minecraft-backup', '-n', NS], { fallback: null });
  const env = cron?.spec?.jobTemplate?.spec?.template?.spec?.containers?.[0]?.env ?? [];
  const value = (name) => env.find((item) => item.name === name)?.value ?? 'unknown';
  return { mode: value('BACKUP_MODE'), limit: value('BACKUP_LIMIT'), interval: formatCron(cron?.spec?.schedule ?? 'unknown'), schedule: cron?.spec?.schedule ?? 'unknown' };
}
function backupDirs() {
  const root = rel('backups');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && (/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(entry.name) || entry.name === 'latest'))
    .map(entry => {
      const fullPath = path.join(root, entry.name);
      const stat = fs.statSync(fullPath);
      return { name: entry.name, path: fullPath, createdAt: stat.mtime, sizeBytes: dirSize(fullPath) };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}
function latestBackupFolder() { return backupDirs()[0] ?? null; }
function dirSize(target) {
  let total = 0;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) total += dirSize(full);
    else total += fs.statSync(full).size;
  }
  return total;
}
function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
function formatCron(schedule) {
  const match = String(schedule).match(/^\*\/(\d+) \* \* \* \*$/);
  if (!match) return schedule;
  return `${match[1]}m`;
}
function formatDurationFromSeconds(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
function age(dateValue) {
  if (!dateValue) return 'not available';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateValue).getTime()) / 1000));
  if (seconds < 60) return 'less than a minute ago';
  return `${formatDurationFromSeconds(seconds)} ago`;
}
function durationSince(dateValue) {
  if (!dateValue) return 'not available';
  return formatDurationFromSeconds(Math.max(0, Math.floor((Date.now() - new Date(dateValue).getTime()) / 1000)));
}
function queryPlayers() {
  const code = "import { loadConfig } from './src/config.js'; import { createLogger } from './src/logger.js'; import { KubernetesStatusProvider } from './src/platform/kubernetes-status-provider.js'; import { MinecraftQueryProvider } from './src/platform/minecraft-query-provider.js'; import { MineOpsPlatformService } from './src/platform/mineops-platform-service.js'; const config = loadConfig(); const logger = createLogger({ serviceName: 'mineops-cli', level: 'error' }); const service = new MineOpsPlatformService({ statusProvider: new KubernetesStatusProvider({ config, logger }), playerProvider: new MinecraftQueryProvider({ config, logger }) }); console.log(JSON.stringify(await service.getPlayers()));";
  const result = run('kubectl', ['exec', '-n', NS, 'deployment/discord-bot', '--', 'node', '--input-type=module', '-e', code], { capture: true, allowFailure: true });
  if (result.status !== 0) return null;
  try { return JSON.parse(result.stdout.trim()); } catch { return null; }
}
function readJsonl(remotePath) {
  const result = botExec(`test -f ${remotePath} && tail -n 100 ${remotePath} || true`);
  if (result.status !== 0 || !result.stdout.trim()) return [];
  return result.stdout.trim().split(/\r?\n/).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
}
function alertsData() { return readJsonl(`${DATA_DIR}/alerts/alerts.jsonl`); }
function eventsData() { return readJsonl(`${DATA_DIR}/events/events.jsonl`); }
function maintenanceState() {
  const result = botExec(`test -f ${DATA_DIR}/maintenance/state.json && cat ${DATA_DIR}/maintenance/state.json || true`);
  if (result.status !== 0 || !result.stdout.trim()) return { enabled: false };
  try { return JSON.parse(result.stdout); } catch { return { enabled: false }; }
}
function writeMaintenance(enabled, reason = 'Scheduled maintenance') {
  const payload = JSON.stringify({ enabled, reason, timestamp: new Date().toISOString() }).replace(/'/g, "'\\''");
  const message = enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled';
  const eventPayload = JSON.stringify({ timestamp: new Date().toISOString(), type: 'maintenance', severity: 'INFO', message }).replace(/'/g, "'\\''");
  botExec(`mkdir -p ${DATA_DIR}/maintenance ${DATA_DIR}/events && printf '%s' '${payload}' > ${DATA_DIR}/maintenance/state.json && printf '%s\\n' '${eventPayload}' >> ${DATA_DIR}/events/events.jsonl`, { allowFailure: false });
}
function recordLocalEvent(type, severity, message) {
  const eventPayload = JSON.stringify({ timestamp: new Date().toISOString(), type, severity, message }).replace(/'/g, "'\\''");
  botExec(`mkdir -p ${DATA_DIR}/events && printf '%s\\n' '${eventPayload}' >> ${DATA_DIR}/events/events.jsonl`);
}
function snapshot() {
  const minecraft = deploymentState('minecraft');
  const discord = deploymentState('discord-bot');
  const playit = deploymentState('playit');
  const nodes = kubectlJson(['get', 'nodes'], { fallback: { items: [] } })?.items ?? [];
  const pod = podFor('app.kubernetes.io/name=minecraft');
  const players = queryPlayers();
  const backup = latestBackupJob();
  const backupCfg = backupConfig();
  const pvc = kubectlJson(['get', 'pvc', 'minecraft-data', '-n', NS], { fallback: null });
  const maintenance = maintenanceState();
  return { minecraft, discord, playit, nodes, pod, players, backup, backupCfg, pvc, maintenance };
}
function healthWord(okValue) { return okValue ? green('HEALTHY') : red('DEGRADED'); }
function stateWord(state) { return state === 'ONLINE' ? green('ONLINE') : state === 'SCALED TO 0' ? yellow(state) : red(state); }

async function init() {
  header(`${ICONS.spark} MineOps Setup Wizard`);
  for (const command of ['docker', 'k3d', 'kubectl', 'terraform', 'node']) hasCommand(command) ? ok(command === 'node' ? 'Node.js' : command) : fail(command);
  run('docker', ['ps'], { capture: true });
  const env = loadDotEnv();
  const missing = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID', 'PLAYIT_SECRET_KEY'].filter(key => !env[key]);
  if (missing.length > 0) throw new Error(`Missing required .env values: ${missing.join(', ')}`);
  ok('.env validated');
  fs.mkdirSync(env.MINEOPS_STORAGE_PATH, { recursive: true });
  fs.mkdirSync(env.MINEOPS_BACKUP_HOST_PATH, { recursive: true });
  ok('host storage prepared');
  const clusters = run('k3d', ['cluster', 'list', CLUSTER], { capture: true, allowFailure: true });
  clusters.status === 0 && clusters.stdout.includes(CLUSTER) ? ok('cluster exists') : warn('cluster does not exist; run mineops cluster create');
  if (kubectlJson(['get', 'namespace', NS], { fallback: null })) { run('powershell', powershellArgs('bootstrap-secrets.ps1')); ok('secrets applied'); }
  else warn('secrets not applied yet; namespace does not exist');
  print(''); print('Ready to deploy');
}
async function cluster(args) {
  const action = args[0];
  if (action === 'create') { header('Creating MineOps Cluster'); const env = loadDotEnv({ optional: true }); fs.mkdirSync(env.MINEOPS_STORAGE_PATH, { recursive: true }); fs.mkdirSync(env.MINEOPS_BACKUP_HOST_PATH, { recursive: true }); run('k3d', ['cluster', 'create', '--config', rel('infra', 'k3d', 'local.yaml')]); ok('Cluster created'); return; }
  if (action === 'delete') { header('Deleting MineOps Cluster'); run('k3d', ['cluster', 'delete', CLUSTER], { allowFailure: true }); ok('Cluster deleted'); return; }
  if (action === 'recreate') { await cluster(['delete']); await cluster(['create']); return; }
  if (action === 'status') { const s = snapshot(); header(`${ICONS.cluster} Kubernetes Cluster`); print(`Name: ${CLUSTER}`); print(`Status: ${s.nodes.length > 0 ? 'Running' : 'Unavailable'}`); print(`Nodes: ${s.nodes.length}`); print(`Version: ${s.nodes[0]?.status?.nodeInfo?.kubeletVersion ?? 'unknown'}`); return; }
  throw new Error('Usage: mineops cluster <create|delete|recreate|status>');
}
async function deploy() {
  header('Deploying MineOps');
  print('[1/4] Building Discord Bot'); run('docker', ['build', '-t', BOT_IMAGE, rel('apps', 'discord-bot')]);
  print('[2/4] Importing Image'); run('k3d', ['image', 'import', BOT_IMAGE, '-c', CLUSTER]);
  print('[3/4] Terraform Apply'); run('terraform', ['init', '-input=false'], { cwd: rel('infra', 'terraform') }); run('terraform', ['apply', '-auto-approve'], { cwd: rel('infra', 'terraform') });
  print('[4/4] Applying Kubernetes Resources'); run('powershell', powershellArgs('bootstrap-secrets.ps1')); run('kubectl', ['apply', '-f', rel('platform', 'kubernetes', 'discord-bot'), '--recursive']); run('kubectl', ['rollout', 'status', 'deployment/discord-bot', '-n', NS, '--timeout=180s']);
  recordLocalEvent('system', 'INFO', 'MineOps deployed'); footer('Overall Result: DEPLOYMENT SUCCESSFUL');
}
async function status() {
  const s = snapshot(); const backupHealthy = s.backup?.complete ? 'Healthy' : s.backup?.failed ? 'Failed' : 'No completed backup yet'; const clusterReady = s.nodes.length > 0 ? 'Ready' : 'Unavailable'; const overall = s.minecraft.state === 'ONLINE' && s.discord.state === 'ONLINE' && clusterReady === 'Ready' && backupHealthy !== 'Failed' && !s.maintenance.enabled;
  header(`${ICONS.spark} MineOps Platform Status`);
  print(`${ICONS.game} Minecraft`); print(s.minecraft.state === 'ONLINE' ? green('Running') : stateWord(s.minecraft.state)); print(`Uptime: ${durationSince(s.pod?.status?.startTime)}`); print('');
  print(`${ICONS.bot} Discord Bot`); print(s.discord.state === 'ONLINE' ? green('Connected') : stateWord(s.discord.state)); print('');
  print(`${ICONS.backup} Backups`); print(backupHealthy === 'Healthy' ? green('Healthy') : yellow(backupHealthy)); print('');
  print(`${ICONS.cluster} Cluster`); print(clusterReady === 'Ready' ? green('Ready') : red(clusterReady)); print('');
  print(`${ICONS.wrench} Maintenance`); print(s.maintenance.enabled ? yellow('ON') : green('OFF'));
  footer(`Overall Health: ${overall ? green('HEALTHY') : yellow('MAINTENANCE/DEGRADED')}`);
}
async function metrics() {
  const s = snapshot(); const latest = latestBackupFolder();
  header(`${ICONS.spark} MineOps Metrics`);
  print(`${ICONS.players} Players`); print(s.players?.available ? `${s.players.onlineCount} / ${s.players.maxPlayers}` : 'not available'); print('');
  print(`${ICONS.disk} World Storage`); print(latest ? `${formatBytes(latest.sizeBytes)} latest backup; PVC capacity ${s.pvc?.status?.capacity?.storage ?? 'unknown'}` : `PVC capacity ${s.pvc?.status?.capacity?.storage ?? 'unknown'}`); print('');
  print(`${ICONS.backup} Backups`); print(`Last Backup: ${age(s.backup?.completionTime)}`); print('');
  print(`${ICONS.clock} Server Uptime`); print(durationSince(s.pod?.status?.startTime)); print(line());
}
async function doctor() {
  print('Running Platform Diagnostics...'); print(''); const checks = [ ['Cluster Reachable', () => snapshot().nodes.length > 0], ['Terraform State Healthy', () => terraformPlanClean()], ['Minecraft Deployment Healthy', () => deploymentState('minecraft').state === 'ONLINE'], ['PVC Bound', () => kubectlJson(['get', 'pvc', 'minecraft-data', '-n', NS])?.status?.phase === 'Bound'], ['Discord Bot Connected', () => deploymentState('discord-bot').state === 'ONLINE'], ['Backup CronJob Healthy', () => Boolean(kubectlJson(['get', 'cronjob', 'minecraft-backup', '-n', NS], { fallback: null }))] ]; let failures = 0; for (const [label, check] of checks) { try { check() ? ok(label) : (fail(label), failures++); } catch { fail(label); failures++; } } print(''); print('Result:'); print(failures === 0 ? 'No issues found' : `${failures} issue(s) found`); if (failures > 0) process.exitCode = 1;
}
async function info() { const s = snapshot(); header('MineOps Information'); print(`Version: ${VERSION}`); print(`Cluster: ${CLUSTER}`); print(`Namespace: ${NS}`); print(`Backup Mode: ${s.backupCfg.mode}`); print(`Backup Interval: ${s.backupCfg.interval}`); print(`Environment: local-k3d`); }
async function dashboard(args) { const once = args.includes('--once'); do { const s = snapshot(); if (!once) console.clear(); header('MineOps Dashboard'); print(`${ICONS.game} Minecraft       ${stateWord(s.minecraft.state)}`); print(`${ICONS.players} Players         ${s.players?.available ? `${s.players.onlineCount}/${s.players.maxPlayers}` : 'unknown'}`); print(`${ICONS.clock} Uptime          ${durationSince(s.pod?.status?.startTime)}`); print(`${ICONS.backup} Backup Age      ${age(s.backup?.completionTime)}`); print(`${ICONS.backup} Backups         ${backupDirs().length} available`); print(`${ICONS.bot} Discord Bot     ${stateWord(s.discord.state)}`); print(`${ICONS.cluster} Cluster         ${healthWord(s.nodes.length > 0)}`); print(`${ICONS.wrench} Maintenance     ${s.maintenance.enabled ? yellow('ON') : green('OFF')}`); print(''); print('Press Ctrl+C to exit. Refresh: 10s'); if (once) break; await sleep(10000); } while (true); }
async function timeline(args) { const typeIndex = args.indexOf('--type'); const filter = typeIndex >= 0 ? args[typeIndex + 1] : null; const events = collectEvents(filter).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 20); header(`${ICONS.clock} MineOps Timeline`); if (events.length === 0) { print('No events recorded'); return; } for (const event of events) print(`${eventIcon(event.severity)} [${shortTime(event.timestamp)}] ${event.message} (${age(event.timestamp)})`); print(''); print(`Showing latest ${events.length} events`); }
function collectEvents(filter) { const result = []; const job = latestBackupJob(); if (job?.complete) result.push({ timestamp: job.completionTime, type: 'backup', severity: 'INFO', message: 'Backup completed' }); if (job?.failed) result.push({ timestamp: job.startTime, type: 'backup', severity: 'WARN', message: 'Backup failed' }); const mcPod = podFor('app.kubernetes.io/name=minecraft'); if (mcPod?.status?.startTime) result.push({ timestamp: mcPod.status.startTime, type: 'server', severity: 'INFO', message: 'Minecraft started' }); result.push(...eventsData()); result.push(...alertsData().map(a => ({ ...a, type: a.type ?? 'alert' }))); return filter ? result.filter(e => e.type === filter) : result; }
function eventIcon(severity) { if (severity === 'WARN') return ICONS.warn; if (severity === 'ERROR') return ICONS.fail; return ICONS.ok; }
function shortTime(timestamp) { const d = new Date(timestamp); return Number.isNaN(d.getTime()) ? '??:??' : d.toISOString().slice(11, 16); }
async function events(args) { await timeline(args); }
async function backups(args) { const latestOnly = args[0] === 'latest'; const cfg = backupConfig(); const list = backupDirs(); header(latestOnly ? 'Latest Backup' : 'Available Backups'); const rows = latestOnly ? list.slice(0, 1) : list.slice(0, 20); if (rows.length === 0) { print('No backups found'); return; } rows.forEach((b, i) => print(`${String(i + 1).padStart(2)}. ${b.name.padEnd(20)} ${formatBytes(b.sizeBytes).padStart(8)} ${age(b.createdAt).padStart(12)} ${green('SUCCESS')}`)); print(''); print(`Backup Mode: ${cfg.mode} | Limit: ${cfg.limit}`); }
async function alerts(args) { const history = args.includes('--history'); const alerts = alertsData().slice(history ? -50 : -10).reverse(); header('Recent Alerts'); if (alerts.length === 0) { print('No active alerts'); return; } for (const alert of alerts) { print(`[${alert.severity ?? 'INFO'}] ${alert.message}`); print(`${age(alert.timestamp)} ${alert.resolved ? green('RESOLVED') : yellow('ACTIVE')}`); print(''); } }
async function maintenance(args) { const mode = args[0]; if (!['on', 'off'].includes(mode)) throw new Error('Usage: mineops maintenance <on|off>'); writeMaintenance(mode === 'on', args.slice(1).join(' ') || 'Scheduled maintenance'); header(mode === 'on' ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled'); print(mode === 'on' ? 'Alerts are muted. Status in Discord will show maintenance.' : 'Alerts are active. Platform returned to normal operation.'); }
async function backup() { const name = `mineops-manual-backup-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`; header('Backup Started'); recordLocalEvent('backup', 'INFO', 'Backup started'); run('kubectl', ['create', 'job', '-n', NS, name, '--from=cronjob/minecraft-backup']); const wait = run('kubectl', ['wait', '-n', NS, '--for=condition=complete', `job/${name}`, '--timeout=300s'], { allowFailure: true }); recordLocalEvent('backup', wait.status === 0 ? 'INFO' : 'ERROR', wait.status === 0 ? 'Backup completed' : 'Backup failed'); print('Mode:'); print(backupConfig().mode); print(''); print('Result:'); print(wait.status === 0 ? green('Success') : red('Failed')); print(''); print('Location:'); print(`backups/${latestBackupFolder()?.name ?? 'not available'}`); if (wait.status !== 0) process.exitCode = 1; }
async function restore(args) { const target = args[0]; if (!target) throw new Error('Usage: mineops restore <latest|timestamp>'); header('WARNING: Minecraft will be stopped'); print(`Backup: ${target}`); print(''); print('Restoring...'); run('powershell', powershellArgs('restore.ps1', [target])); recordLocalEvent('system', 'INFO', `Restore completed from ${target}`); footer('Restore Complete - Minecraft restarted successfully'); }
async function logs(args) { const target = args[0]; const map = { minecraft: ['logs', '-n', NS, 'deployment/minecraft', '--tail=120'], discord: ['logs', '-n', NS, 'deployment/discord-bot', '--tail=120'], backup: ['logs', '-n', NS, '-l', 'app.kubernetes.io/name=minecraft-backup', '--all-containers=true', '--tail=120'] }; if (!map[target]) throw new Error('Usage: mineops logs <minecraft|discord|backup>'); run('kubectl', map[target], { allowFailure: target === 'backup' }); }
async function main() { const [command, ...args] = process.argv.slice(2); try { if (command === 'init') return init(args); if (command === 'cluster') return cluster(args); if (command === 'deploy') return deploy(args); if (command === 'status') return status(args); if (command === 'metrics') return metrics(args); if (command === 'doctor') return doctor(args); if (command === 'info') return info(args); if (command === 'dashboard') return dashboard(args); if (command === 'timeline') return timeline(args); if (command === 'events') return events(args); if (command === 'backups') return backups(args); if (command === 'alerts') return alerts(args); if (command === 'maintenance') return maintenance(args); if (command === 'backup') return backup(args); if (command === 'restore') return restore(args); if (command === 'logs') return logs(args); print('Usage: mineops <init|cluster|deploy|status|metrics|doctor|info|dashboard|timeline|events|backups|alerts|maintenance|backup|restore|logs>'); process.exitCode = 1; } catch (error) { print(''); fail(error.message); process.exitCode = 1; } }
await main();
