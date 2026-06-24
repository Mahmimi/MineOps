import { backupCommand } from './backup.js';
import { backupsCommand } from './backups.js';
import { clusterCommand } from './cluster.js';
import { configCommand } from './config.js';
import { dashboardCommand } from './dashboard.js';
import { deployCommand } from './deploy.js';
import { doctorCommand } from './doctor.js';
import { eventsCommand } from './events.js';
import { healthCommand } from './health.js';
import { helpCommand } from './help.js';
import { infoCommand } from './info.js';
import { initCommand } from './init.js';
import { importCommand } from './import.js';
import { logsCommand } from './logs.js';
import { maintenanceCommand } from './maintenance.js';
import { metricsCommand } from './metrics.js';
import { playitCommand } from './playit.js';
import { restartCommand } from './restart.js';
import { restoreCommand } from './restore.js';
import { startCommand } from './start-stop.js';
import { statusCommand } from './status.js';
import { stopCommand } from './start-stop.js';
import { timelineCommand } from './timeline.js';
import { updateCommand } from './update.js';
import { alertsCommand } from './alerts.js';
import { validateCommand } from './validate.js';
import { versionCommand } from './version.js';

export function createRegistry() {
  const commands = [
    alertsCommand,
    backupCommand,
    backupsCommand,
    clusterCommand,
    configCommand,
    dashboardCommand,
    deployCommand,
    doctorCommand,
    eventsCommand,
    healthCommand,
    helpCommand,
    infoCommand,
    initCommand,
    importCommand,
    logsCommand,
    maintenanceCommand,
    metricsCommand,
    playitCommand,
    restartCommand,
    restoreCommand,
    startCommand,
    statusCommand,
    stopCommand,
    timelineCommand,
    updateCommand,
    validateCommand,
    versionCommand,
  ];
  return new Map(commands.map((command) => [command.name, command]));
}
