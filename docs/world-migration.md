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
3. Reports the detected payload size and file count.
4. Verifies Minecraft is stopped.
5. Verifies no backup Job is active.
6. Creates a temporary migration pod.
7. Mounts the `minecraft-data` PVC.
8. Replaces `/minecraft-data/world`.
9. Streams only the world folder into `/minecraft-data/world`.
10. Reports copy progress while the transfer is running.
11. Validates `world/level.dat`.
12. Repairs world file ownership and permissions.
13. Emits a `World Imported` timeline event.
14. Deletes the migration pod.

When the source is a server data root such as `D:\minecraft-server\data`, MineOps imports
`D:\minecraft-server\data\world`. Runtime folders such as `cache`, `libraries`, `versions`,
and downloaded server jars are intentionally skipped. MineOps uses a tar stream through
`kubectl exec` so the CLI can report progress and finish cleanly when the archive stream ends.

## Git Safety

World data is not committed to Git.

The import operation copies local files into Kubernetes storage only.
