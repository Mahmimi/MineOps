# Upgrading

Upgrade workflows in MineOps depend on what you are changing.

## Updating Minecraft Runtime Version

Use the CLI workflow:

```powershell
mineops update minecraft LATEST --instance survival
mineops update minecraft 1.21.1 --instance survival
```

The current implementation:

1. checks current config and runtime version
2. creates a backup
3. updates `mineops.yaml`
4. patches the live deployment
5. waits for rollout when Minecraft is running
6. records an event

## Reconciling Platform Changes

After editing `mineops.yaml`, run:

```powershell
mineops validate
mineops init
```

MineOps will regenerate artifacts and reconcile infrastructure.

## Cluster Definition Changes

If the k3d config or mount layout changes, recreate the cluster explicitly:

```powershell
mineops cluster recreate
mineops init
```

## Multi-Instance Adoption

Adding a new instance is an upgrade to platform topology, not just to Minecraft config.

Recommended sequence:

1. add the new instance to `mineops.yaml`
2. run `mineops validate`
3. inspect `mineops config graph`
4. run `mineops init`
5. confirm with `mineops status --all`

## Related

- [Deployment Pipeline](../architecture/deployment-pipeline.md)
- [First Server](../getting-started/first-server.md)
