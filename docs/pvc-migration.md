# PVC Migration Procedure

This procedure copies legacy Minecraft world data into the Kubernetes PVC without modifying the legacy source.

Do not run this until runtime validation is complete and a fresh backup exists.

## Source And Destination

Legacy source:

```text
legacy/docker-compose/minecraft-localhost/data
```

Kubernetes destination:

```text
mineops/minecraft-data
```

## Preconditions

- Legacy Minecraft server is stopped cleanly.
- A fresh timestamped backup exists.
- Backup contains `world/level.dat`, player data, configs, plugins, and logs.
- Kubernetes `minecraft` Deployment is scaled down or stopped.
- `minecraft-data` PVC is Bound.
- No other pod is writing to the PVC.

## 1. Stop Kubernetes Minecraft

```bash
kubectl --kubeconfig .local/kubeconfig-mineops.yaml scale deployment/minecraft -n mineops --replicas=0
kubectl --kubeconfig .local/kubeconfig-mineops.yaml rollout status deployment/minecraft -n mineops
```

## 2. Create A Temporary Migration Pod

```bash
kubectl --kubeconfig .local/kubeconfig-mineops.yaml run minecraft-data-migrator \
  --namespace mineops \
  --image=busybox:1.36 \
  --restart=Never \
  --overrides='{"spec":{"containers":[{"name":"migrator","image":"busybox:1.36","command":["sh","-c","sleep 3600"],"volumeMounts":[{"name":"minecraft-data","mountPath":"/data"}]}],"volumes":[{"name":"minecraft-data","persistentVolumeClaim":{"claimName":"minecraft-data"}}]}}'
```

Wait for it:

```bash
kubectl --kubeconfig .local/kubeconfig-mineops.yaml wait --for=condition=Ready pod/minecraft-data-migrator -n mineops --timeout=120s
```

## 3. Clear Validation-Only PVC Data

Only do this after confirming the PVC contains a disposable validation world, not real production data.

```bash
kubectl --kubeconfig .local/kubeconfig-mineops.yaml exec -n mineops minecraft-data-migrator -- sh -c "rm -rf /data/* /data/.[!.]* /data/..?*"
```

## 4. Copy From A Verified Backup

Use a backup path, not the live legacy data path.

Example:

```bash
kubectl --kubeconfig .local/kubeconfig-mineops.yaml cp "legacy/docker-compose/minecraft-localhost/data-backup/pre-upgrade-20260620-193230/." mineops/minecraft-data-migrator:/data
```

If the chosen backup has an extra nested `data/` directory, copy that directory's contents instead:

```bash
kubectl --kubeconfig .local/kubeconfig-mineops.yaml cp "legacy/docker-compose/minecraft-localhost/data-backup/backup 19-6-2026/data/." mineops/minecraft-data-migrator:/data
```

## 5. Verify Copied Data

```bash
kubectl --kubeconfig .local/kubeconfig-mineops.yaml exec -n mineops minecraft-data-migrator -- sh -c "test -f /data/world/level.dat && ls -la /data | head"
```

## 6. Remove Migration Pod

```bash
kubectl --kubeconfig .local/kubeconfig-mineops.yaml delete pod minecraft-data-migrator -n mineops
```

## 7. Start Minecraft

```bash
kubectl --kubeconfig .local/kubeconfig-mineops.yaml scale deployment/minecraft -n mineops --replicas=1
kubectl --kubeconfig .local/kubeconfig-mineops.yaml rollout status deployment/minecraft -n mineops
kubectl --kubeconfig .local/kubeconfig-mineops.yaml logs -n mineops deploy/minecraft --tail=100
```

## Validation Checklist

- Minecraft starts without creating a new empty world.
- Logs do not show world conversion or corruption errors.
- Existing players, ops, whitelist, plugins, and configs are present.
- Service remains reachable on port `25565`.
- Legacy source and backups remain unchanged.
