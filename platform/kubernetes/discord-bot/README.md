# Discord Bot Kubernetes Resources

These manifests deploy the read-only MineOps Discord Bot.

Apply order:

1. `scripts/bootstrap-secrets.ps1`
2. `serviceaccount.yaml`
3. `role.yaml`
4. `rolebinding.yaml`
5. `deployment.yaml`
6. `service.yaml`

`secret.yaml.example` is a shape reference only. Do not apply it directly.

The Role is namespace-scoped and read-only. It allows only `get` and `list` on Pods, Services, and Deployments in the `mineops` namespace.
