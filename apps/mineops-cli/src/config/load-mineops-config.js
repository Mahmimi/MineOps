import { MineOpsConfig } from '../domain/config/mineops-config.js';
import { parseRawMineOpsConfig } from './schema/mineops-config-schema.js';

export function loadMineOpsConfig({ adapter }) {
  const raw = parseRawMineOpsConfig(adapter.loadRaw());

  return new MineOpsConfig({
    source: raw.source,
    cluster: raw.cluster,
    globals: {
      files: raw.files,
      env: raw.env,
      raw: raw.raw,
    },
    instances: raw.instances,
  });
}

