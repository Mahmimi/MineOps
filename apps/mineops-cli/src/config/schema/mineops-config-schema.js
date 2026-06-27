import { z } from 'zod';
import { UserInputError } from '../../domain/errors.js';
import {
  isValidCpuQuantity,
  isValidCronExpression,
  isValidMemoryQuantity,
  isValidNamespaceName,
} from './validators.js';

const fileStateSchema = z.strictObject({
  path: z.string().min(1),
  exists: z.boolean(),
});

const adminFileSchema = fileStateSchema.extend({
  raw: z.string().nullable(),
});

const resourceRequirementsSchema = z.strictObject({
  cpu: z.string().refine(isValidCpuQuantity, { error: 'must be a valid Kubernetes CPU quantity' }),
  memory: z.string().refine(isValidMemoryQuantity, { error: 'must be a valid Kubernetes memory quantity' }),
});

const minecraftYamlSchema = z.strictObject({
  minecraft: z.strictObject({
    type: z.enum(['VANILLA', 'PAPER', 'FABRIC', 'FORGE', 'NEOFORGE', 'SPIGOT', 'BUKKIT', 'PURPUR']),
    version: z.union([
      z.literal('LATEST'),
      z.string().regex(/^\d+(\.\d+){1,2}$/, 'must be LATEST or a Minecraft version like 1.21.1'),
    ]),
  }),
  world: z.strictObject({
    seed: z.union([z.string(), z.number()]).optional(),
    difficulty: z.enum(['peaceful', 'easy', 'normal', 'hard']),
    mode: z.enum(['survival', 'creative', 'adventure', 'spectator']),
  }),
  server: z.strictObject({
    memory: z.string().refine(isValidMemoryQuantity, { error: 'must be a valid memory string' }),
    onlineMode: z.boolean(),
    maxPlayers: z.number().int().positive(),
  }),
  operators: z.array(z.union([z.string(), z.number()])).optional(),
  backup: z.strictObject({
    enabled: z.boolean(),
    interval: z.string().refine(isValidCronExpression, { error: 'must be a 5-field cron expression' }),
    mode: z.enum(['replace', 'append', 'append_with_limit']),
    limit: z.number().int().positive().optional(),
  }).superRefine((backup, context) => {
    if (backup.mode === 'append_with_limit' && backup.limit === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['limit'],
        message: 'is required when backup.mode is append_with_limit',
      });
    }
  }),
  storage: z.strictObject({
    size: z.string().refine(isValidMemoryQuantity, { error: 'must be a valid Kubernetes storage quantity' }),
    hostPath: z.string().optional(),
  }).optional(),
  resources: z.strictObject({
    requests: resourceRequirementsSchema,
    limits: resourceRequirementsSchema,
  }).optional(),
});

const minecraftServiceSchema = z.strictObject({
  type: z.literal('minecraft'),
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  config: minecraftYamlSchema,
});

const discordServiceSchema = z.strictObject({
  type: z.literal('discord'),
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  config: z.strictObject({
    token: z.string().min(1, 'is required'),
    clientId: z.string().min(1, 'is required'),
    guildId: z.string().min(1, 'is required'),
    alertChannelId: z.string(),
    adminsFile: adminFileSchema,
  }),
});

const playitServiceSchema = z.strictObject({
  type: z.literal('playit'),
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  config: z.strictObject({
    secretKey: z.string().min(1, 'is required'),
    joinAddress: z.string(),
  }),
});

const backupServiceSchema = z.strictObject({
  type: z.literal('backup'),
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  config: z.strictObject({
    hostPath: z.string().optional(),
    settings: z.strictObject({
      enabled: z.boolean(),
      interval: z.string().refine(isValidCronExpression, { error: 'must be a 5-field cron expression' }),
      mode: z.enum(['replace', 'append', 'append_with_limit']),
      limit: z.number().int().positive().optional(),
    }),
  }),
});

const serviceSchema = z.discriminatedUnion('type', [
  minecraftServiceSchema,
  discordServiceSchema,
  playitServiceSchema,
  backupServiceSchema,
]);

const instanceSchema = z.strictObject({
  name: z.string().min(1),
  namespace: z.string().refine(isValidNamespaceName, { error: 'must be a valid Kubernetes namespace name' }),
  enabled: z.boolean().optional(),
  labels: z.record(z.string(), z.string()).optional(),
  services: z.array(serviceSchema).min(1),
  legacy: z.strictObject({
    env: z.record(z.string(), z.string()),
    minecraft: minecraftYamlSchema,
    files: z.strictObject({
      env: z.string(),
      minecraft: z.string(),
      admins: z.string(),
    }),
  }).optional(),
});

export const rawMineOpsConfigSchema = z.strictObject({
  source: z.string().min(1),
  files: z.strictObject({
    env: fileStateSchema,
    minecraft: fileStateSchema,
    admins: fileStateSchema,
  }).superRefine((files, context) => {
    for (const file of ['env', 'minecraft']) {
      if (!files[file].exists) {
        context.addIssue({
          code: 'custom',
          path: [file, 'path'],
          message: 'file does not exist',
        });
      }
    }
  }),
  cluster: z.strictObject({
    name: z.string().min(1),
  }),
  env: z.record(z.string(), z.string()),
  raw: z.strictObject({
    env: z.string().nullable(),
    minecraft: z.string().nullable(),
    admins: z.string().nullable(),
  }),
  instances: z.array(instanceSchema).min(1),
}).superRefine((config, context) => {
  const instanceNames = new Set();
  const namespaces = new Set();

  config.instances.forEach((instance, index) => {
    if (instanceNames.has(instance.name)) {
      context.addIssue({
        code: 'custom',
        path: ['instances', index, 'name'],
        message: 'duplicate instance name',
      });
    }
    instanceNames.add(instance.name);

    if (namespaces.has(instance.namespace)) {
      context.addIssue({
        code: 'custom',
        path: ['instances', index, 'namespace'],
        message: 'duplicate namespace',
      });
    }
    namespaces.add(instance.namespace);
  });
});

function formatIssue(issue) {
  const path = issue.path.length > 0 ? issue.path.join('.') : 'configuration';
  return `${path}: ${issue.message}`;
}

export function parseRawMineOpsConfig(raw) {
  const result = rawMineOpsConfigSchema.safeParse(raw);
  if (result.success) return result.data;

  const details = result.error.issues.map(formatIssue).join('\n');
  throw new UserInputError(`Invalid MineOps configuration:\n${details}`, {
    usage: 'mineops init',
  });
}

