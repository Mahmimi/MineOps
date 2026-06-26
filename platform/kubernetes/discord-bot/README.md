# Discord Bot Kubernetes Resources

These manifests deploy the MineOps Discord Bot.

Apply order:

1. `scripts/bootstrap-secrets.ps1`
2. `serviceaccount.yaml`
3. `role.yaml`
4. `rolebinding.yaml`
5. `deployment.yaml`
6. `service.yaml`

`secret.yaml.example` is a shape reference only. Do not apply it directly.

The Role is namespace-scoped. It can read MineOps status resources, scale only the `minecraft` Deployment, exec only into pods for console-safe lifecycle commands, and suspend or resume only the `minecraft-backup` CronJob.
