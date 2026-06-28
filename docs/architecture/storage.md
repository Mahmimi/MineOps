# Storage

MineOps treats persistent world data and backup data separately.

## Persistent World Storage

Minecraft world data lives on a PVC named `minecraft-data`.

Terraform provisions:

- one persistent volume
- one persistent volume claim
- one host-backed path inside the k3d node

The generated Terraform variables derive a stable per-instance path such as:

```text
/var/lib/rancher/k3s/storage/mineops-minecraft-data-survival
```

That node path is backed by `globals.storagePath` on the host.

## Backup Storage

Backups live under `/backups` inside the cluster and map back to `globals.backupHostPath` on the host.

For non-default instances, MineOps uses a per-instance subdirectory such as:

```text
D:/MineOps/production/backups/survival
```

## Safety Model

- deployment is idempotent
- backups are append-oriented by default
- restore replaces restore-oriented files only
- import copies world data through a temporary PVC-mounted pod
- storage configuration is explicit in config and generated vars

## Why This Matters

Storage is where accidental singleton assumptions are most dangerous. Multi-instance MineOps keeps storage isolated by namespace, PVC, and host path rather than sharing mutable folders across services.

## Related

- [Backup And Restore](../operator-guide/backup-and-restore.md)
- [Infrastructure](infrastructure.md)
