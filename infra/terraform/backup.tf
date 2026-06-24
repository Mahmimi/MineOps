locals {
  backup_labels = merge(local.common_labels, {
    "app.kubernetes.io/name"      = "minecraft-backup"
    "app.kubernetes.io/component" = "backup"
  })

  backup_node_path = can(regex("^[A-Za-z]:", var.backup_host_path)) || can(regex("^\\.", var.backup_host_path)) ? "/backups" : var.backup_host_path
}

resource "kubernetes_service_account_v1" "minecraft_backup" {
  metadata {
    name      = "minecraft-backup"
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.backup_labels
  }
}

resource "kubernetes_role_v1" "minecraft_backup" {
  metadata {
    name      = "minecraft-backup"
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.backup_labels
  }

  rule {
    api_groups = [""]
    resources  = ["pods"]
    verbs      = ["get", "list"]
  }

  rule {
    api_groups = [""]
    resources  = ["pods/exec"]
    verbs      = ["create"]
  }
}

resource "kubernetes_role_binding_v1" "minecraft_backup" {
  metadata {
    name      = "minecraft-backup"
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.backup_labels
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account_v1.minecraft_backup.metadata[0].name
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role_v1.minecraft_backup.metadata[0].name
  }
}

resource "kubernetes_config_map_v1" "minecraft_backup" {
  metadata {
    name      = "minecraft-backup"
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.backup_labels
  }

  data = {
    "backup.sh" = <<-SCRIPT
      #!/bin/sh
      set -eu

      log() {
        printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
      }

      kube() {
        kubectl \
          --server="https://kubernetes.default.svc" \
          --certificate-authority="/var/run/secrets/kubernetes.io/serviceaccount/ca.crt" \
          --token="$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
          "$@"
      }

      require_mode() {
        case "$BACKUP_MODE" in
          replace|append|append_with_limit) ;;
          *) log "invalid backup mode: $BACKUP_MODE"; exit 2 ;;
        esac
      }

      find_minecraft_pod() {
        kube --request-timeout="$KUBECTL_REQUEST_TIMEOUT" get pods \
          -n "$NAMESPACE" \
          -l "$MINECRAFT_LABEL_SELECTOR" \
          -o jsonpath='{.items[0].metadata.name}'
      }

      mc_command() {
        command="$1"
        log "minecraft command: $command"
        kube --request-timeout="$KUBECTL_REQUEST_TIMEOUT" exec -n "$NAMESPACE" "$MINECRAFT_POD" -c "$MINECRAFT_CONTAINER" -- gosu minecraft mc-send-to-console "$command"
      }

      mc_broadcast() {
        command="$1"
        attempt=1
        while [ "$attempt" -le 3 ]; do
          if mc_command "say $command"; then
            return 0
          fi
          log "broadcast retry $attempt failed"
          attempt=$((attempt + 1))
          sleep 5
        done
        return 1
      }

      wait_for_stable_minecraft() {
        start_time="$(kube --request-timeout="$KUBECTL_REQUEST_TIMEOUT" get pod -n "$NAMESPACE" "$MINECRAFT_POD" -o jsonpath='{.status.startTime}')"
        if [ -z "$start_time" ]; then
          return 0
        fi
        start_epoch="$(date -d "$start_time" +%s 2>/dev/null || true)"
        now_epoch="$(date -u +%s)"
        if [ -n "$start_epoch" ]; then
          age=$((now_epoch - start_epoch))
          if [ "$age" -lt 90 ]; then
            sleep_for=$((90 - age))
            log "minecraft pod is still stabilizing; waiting $${sleep_for}s before backup announcements"
            sleep "$sleep_for"
          fi
        fi
      }

      copy_world_data() {
        source_path="$1"
        target_path="$2"
        mkdir -p "$target_path"

        backup_items=""
        for item in world world_nether world_the_end server.properties whitelist.json ops.json banned-ips.json banned-players.json usercache.json; do
          if [ -e "$source_path/$item" ]; then
            backup_items="$backup_items $item"
          fi
        done

        if [ -z "$backup_items" ]; then
          log "no world data found to back up"
          exit 1
        fi

        # shellcheck disable=SC2086
        tar -C "$source_path" --ignore-failed-read --warning=no-file-changed -cf - $backup_items | tar -C "$target_path" --no-same-owner -xf -
      }

      enforce_limit() {
        limit="$1"
        count="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??_??-??-??' | sort | wc -l | tr -d ' ')"
        while [ "$count" -gt "$limit" ]; do
          oldest="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??_??-??-??' | sort | sed -n '1p')"
          if [ -z "$oldest" ]; then
            break
          fi
          log "removing old backup: $oldest"
          rm -rf "$oldest"
          count="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??_??-??-??' | sort | wc -l | tr -d ' ')"
        done
      }

      broadcast_result="failed"
      cleanup() {
        if [ -n "$MINECRAFT_POD" ]; then
          mc_command "save-on" || true
          if [ "$broadcast_result" = "success" ]; then
            mc_broadcast "[MineOps] Backup completed successfully." || true
          else
            mc_broadcast "[MineOps] Backup failed. Check server logs." || true
          fi
        fi
      }

      require_mode
      mkdir -p "$BACKUP_ROOT"
      MINECRAFT_POD="$(find_minecraft_pod)"

      if [ -z "$MINECRAFT_POD" ]; then
        log "minecraft pod not found"
        exit 1
      fi

      trap cleanup EXIT

      wait_for_stable_minecraft

      mc_broadcast "[MineOps] Automatic backup will start in 30 seconds. Temporary lag may occur."
      sleep 25
      mc_broadcast "[MineOps] Backup begins in 5 seconds."
      sleep 5

      mc_command "save-all"
      sleep 2
      mc_command "save-off"

      timestamp="$(date -u +%Y-%m-%d_%H-%M-%S)"
      case "$BACKUP_MODE" in
        replace)
          temp_target="$BACKUP_ROOT/.latest.tmp"
          rm -rf "$temp_target"
          copy_world_data "$MINECRAFT_DATA_PATH" "$temp_target"
          rm -rf "$BACKUP_ROOT/latest"
          mv "$temp_target" "$BACKUP_ROOT/latest"
          ;;
        append)
          temp_target="$BACKUP_ROOT/.$timestamp.tmp"
          rm -rf "$temp_target"
          copy_world_data "$MINECRAFT_DATA_PATH" "$temp_target"
          mv "$temp_target" "$BACKUP_ROOT/$timestamp"
          ;;
        append_with_limit)
          temp_target="$BACKUP_ROOT/.$timestamp.tmp"
          rm -rf "$temp_target"
          copy_world_data "$MINECRAFT_DATA_PATH" "$temp_target"
          mv "$temp_target" "$BACKUP_ROOT/$timestamp"
          enforce_limit "$BACKUP_LIMIT"
          ;;
      esac

      broadcast_result="success"
      log "backup completed with mode=$BACKUP_MODE"
    SCRIPT
  }
}

resource "kubernetes_cron_job_v1" "minecraft_backup" {
  metadata {
    name      = "minecraft-backup"
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.backup_labels
  }

  spec {
    schedule                      = local.cfg_backup_schedule
    suspend                       = !local.cfg_backup_enabled
    concurrency_policy            = "Forbid"
    successful_jobs_history_limit = 3
    failed_jobs_history_limit     = 3

    job_template {
      metadata {
        labels = local.backup_labels
      }

      spec {
        backoff_limit              = 1
        ttl_seconds_after_finished = 3600

        template {
          metadata {
            labels = local.backup_labels
          }

          spec {
            service_account_name = kubernetes_service_account_v1.minecraft_backup.metadata[0].name
            restart_policy       = "Never"

            init_container {
              name              = "prepare-backup-path"
              image             = var.backup_image
              image_pull_policy = "IfNotPresent"
              command           = ["/bin/sh", "-c", "mkdir -p /backups && chmod 0777 /backups"]

              volume_mount {
                name       = "minecraft-backups"
                mount_path = "/backups"
              }

              security_context {
                allow_privilege_escalation = false
                run_as_non_root            = false
                run_as_user                = 0
                run_as_group               = 0

                capabilities {
                  drop = ["ALL"]
                }
              }
            }

            container {
              name              = "minecraft-backup"
              image             = var.backup_image
              image_pull_policy = "IfNotPresent"
              command           = ["/bin/sh", "/opt/mineops/backup.sh"]

              env {
                name  = "NAMESPACE"
                value = kubernetes_namespace_v1.mineops.metadata[0].name
              }

              env {
                name  = "MINECRAFT_LABEL_SELECTOR"
                value = "app.kubernetes.io/name=minecraft"
              }

              env {
                name  = "MINECRAFT_CONTAINER"
                value = "minecraft"
              }

              env {
                name  = "MINECRAFT_DATA_PATH"
                value = "/minecraft-data"
              }

              env {
                name  = "BACKUP_ROOT"
                value = "/backups"
              }

              env {
                name  = "BACKUP_MODE"
                value = local.cfg_backup_mode
              }

              env {
                name  = "BACKUP_LIMIT"
                value = tostring(local.cfg_backup_limit)
              }

              env {
                name  = "KUBECTL_REQUEST_TIMEOUT"
                value = "30s"
              }

              resources {
                requests = {
                  cpu    = "100m"
                  memory = "128Mi"
                }

                limits = {
                  cpu    = "1000m"
                  memory = "1Gi"
                }
              }

              volume_mount {
                name       = "backup-script"
                mount_path = "/opt/mineops"
                read_only  = true
              }

              volume_mount {
                name       = "minecraft-data"
                mount_path = "/minecraft-data"
                read_only  = true
              }

              volume_mount {
                name       = "minecraft-backups"
                mount_path = "/backups"
              }

              security_context {
                allow_privilege_escalation = false
                run_as_non_root            = true
                run_as_user                = 1000
                run_as_group               = 1000

                capabilities {
                  drop = ["ALL"]
                }
              }
            }

            volume {
              name = "backup-script"

              config_map {
                name         = kubernetes_config_map_v1.minecraft_backup.metadata[0].name
                default_mode = "0755"
              }
            }

            volume {
              name = "minecraft-data"

              persistent_volume_claim {
                claim_name = kubernetes_persistent_volume_claim_v1.minecraft_data.metadata[0].name
                read_only  = true
              }
            }

            volume {
              name = "minecraft-backups"

              host_path {
                path = local.backup_node_path
                type = "DirectoryOrCreate"
              }
            }
          }
        }
      }
    }
  }
}
