# MineOps Migration Notes

The current Docker Compose deployment has been preserved under `legacy/docker-compose/`.

## Current Preserved Data

- live Minecraft data remains inside the legacy Compose folder
- existing backups remain inside the legacy Compose folder
- no Kubernetes workload should mount the legacy data path directly

## Migration Principles

1. Stop the legacy Minecraft server cleanly before any data copy.
2. Create a fresh timestamped backup from the full live data directory.
3. Verify the backup contains world data, player data, server configuration, plugins, and logs.
4. Create Kubernetes storage separately.
5. Copy data from the verified backup into Kubernetes storage.
6. Start Kubernetes Minecraft only after the copied data is in place.
7. Keep the legacy folder and backups until restore has been tested.

## Out Of Scope For V1 Foundation

- no Minecraft Deployment or StatefulSet
- no Playit Deployment
- no Discord bot
- no controller service
- no automated restore workflow
