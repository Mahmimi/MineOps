# World Migration

MineOps can import existing Minecraft world data into the `minecraft-data` PVC.

## Command

```powershell
.\mineops.ps1 import world "D:\minecraft-server\data"
```

Supported source layouts:

```text
data/
  world/
    level.dat
    region/
```

or:

```text
world/
  level.dat
  region/
```

## Safety Requirements

Import is refused when:

- Minecraft is running
- a backup Job is active
- the source folder does not contain Minecraft world data

Stop the server first:

```powershell
.\mineops.ps1 stop minecraft
.\mineops.ps1 import world "D:\minecraft-server\data"
.\mineops.ps1 start minecraft
```

## Workflow

The import command:

1. Validates the source path.
2. Detects the world structure.
3. Verifies Minecraft is stopped.
4. Creates a temporary migration pod.
5. Mounts the `minecraft-data` PVC.
6. Copies files with `kubectl cp`.
7. Validates `world/level.dat`.
8. Emits a `World Imported` timeline event.
9. Deletes the migration pod.

## Git Safety

World data is not committed to Git.

The import operation copies local files into Kubernetes storage only.
