# Troubleshooting

Use the code-backed diagnostics first.

## Baseline Checks

```powershell
mineops status --all
mineops doctor --all
mineops validate --all
mineops playit --all
```

## Configuration Fails Before Deployment

Symptoms:

- `mineops validate` fails
- `mineops init` exits before infrastructure work

Likely causes:

- missing required environment variables
- duplicate instance names or namespaces
- invalid cron expression
- invalid Kubernetes resource quantity
- missing `mineops.yaml`

Use:

```powershell
mineops config graph
mineops config show
```

## Playit Is Up But Players Still Cannot Join

`mineops playit` considers the join path ready only when:

- Playit deployment is ready
- Minecraft service has endpoints

If the reason says Minecraft has no service endpoints, start or fix Minecraft first:

```powershell
mineops start minecraft --instance survival
mineops logs minecraft --instance survival
```

## Terraform Drift

`mineops doctor` checks Terraform drift by running a plan against the generated instance workdir.

If drift appears:

1. run `mineops init` again
2. rerun `mineops doctor --instance <name>`
3. inspect generated files under `.mineops/terraform/<instance>`

## Backup Problems

Use:

```powershell
mineops logs backup --instance survival
mineops backups --instance survival
```

Common causes:

- backup root not mounted into the cluster
- Minecraft not running when a manual backup was triggered
- stale cluster created before `backupHostPath` changed

## Import Or Restore Problems

Both workflows rely on temporary helper pods and PVC access.

Check:

```powershell
mineops status --instance survival
mineops logs minecraft --instance survival
kubectl get pods -n mineops-survival
```

If restore fails, the script attempts to scale Minecraft back up for safe recovery.

## Cluster Recreation

If the k3d cluster configuration changed, recreate it explicitly:

```powershell
mineops cluster recreate
mineops init
```

## Related

- [Day-2 Operations](day-2-operations.md)
- [Deployment Pipeline](../architecture/deployment-pipeline.md)
