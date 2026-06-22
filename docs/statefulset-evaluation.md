# StatefulSet Evaluation

## Context

MineOps currently runs Minecraft as a Kubernetes Deployment with one replica and a single PVC mounted at `/data`.

Minecraft is stateful, but MineOps Phase 2 intentionally chose a Deployment to keep the runtime simple while the platform foundation stabilizes.

## Deployment

Advantages:

- Simple mental model for local homelab use.
- Works with the existing single PVC.
- Easy to scale between `0` and `1` later.
- Lower migration complexity today.
- Clear Terraform implementation.

Disadvantages:

- Pod identity is not stable.
- PVC relationship is external rather than owned by the workload.
- Less explicit Kubernetes signal that the workload is stateful.
- Future backup automation must carefully discover the correct PVC.

Operational impact:

- Safe as long as replicas stay `0` or `1`.
- Must use `Recreate` strategy to avoid concurrent writers during updates.
- PVC lifecycle is independent from the Deployment, which is useful for preserving data during workload replacement.

## StatefulSet

Advantages:

- Stable pod identity, for example `minecraft-0`.
- More idiomatic for stateful workloads.
- Easier for backup automation to target a known pod and volume relationship.
- Better semantic fit if MineOps later introduces ordered startup/shutdown or controller logic.

Disadvantages:

- More operational complexity for a single local Minecraft server.
- `volumeClaimTemplates` can make migration and PVC retention policy more subtle.
- Renaming or restructuring StatefulSets can create orphaned PVCs if not planned carefully.
- Does not solve horizontal scaling; Minecraft must still remain single-writer.

Operational impact:

- Still limited to `0` or `1` replica.
- Backup automation becomes slightly clearer because pod identity is stable.
- PVC ownership and retention policy must be intentionally designed before migration.

## Recommendation

Recommendation: Keep Deployment for Phase 3.

Justification:

- MineOps currently needs deterministic rebuilds, migration safety, and simple local operations more than stable pod identity.
- The existing external PVC is easier to preserve and migrate.
- Backup automation can target the `minecraft-data` PVC and `app.kubernetes.io/name=minecraft` selector without requiring StatefulSet identity.
- Deployment with `replicas = 1`, `Recreate` strategy, and RWO PVC is sufficient for the current requirements.

Revisit StatefulSet when:

- backup automation needs stronger pod identity guarantees
- a MineOps controller manages lifecycle hooks
- restore workflows become more advanced
- the platform needs explicit PVC retention policies tied to workload identity
