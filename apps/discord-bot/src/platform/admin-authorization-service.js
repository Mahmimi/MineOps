import fs from 'node:fs';

export class AdminAuthorizationService {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
  }

  loadAdmins() {
    try {
      const filePath = this.config.mineops.adminConfigPath;
      if (!fs.existsSync(filePath)) return [];
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return Array.isArray(payload.admins) ? payload.admins : [];
    } catch (error) {
      this.logger?.warn('failed to load MineOps admin allow-list', { error: error.message });
      return [];
    }
  }

  isAdmin(user) {
    const admins = this.loadAdmins();
    return admins.some((admin) => String(admin.discordUserId) === String(user?.id));
  }

  requireAdmin(user) {
    if (this.isAdmin(user)) return;
    const error = new Error('Permission Denied');
    error.code = 'MINEOPS_PERMISSION_DENIED';
    throw error;
  }
}
