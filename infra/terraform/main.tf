locals {
  common_labels = {
    "app.kubernetes.io/part-of"    = "mineops"
    "app.kubernetes.io/managed-by" = "terraform"
    "app.kubernetes.io/instance"   = var.instance_name
  }

  minecraft_labels = merge(local.common_labels, {
    "app.kubernetes.io/name"      = "minecraft"
    "app.kubernetes.io/component" = "game-server"
  })

  minecraft_query_labels = merge(local.common_labels, {
    "app.kubernetes.io/name"      = "minecraft-query"
    "app.kubernetes.io/component" = "game-server-query"
  })

  playit_labels = merge(local.common_labels, {
    "app.kubernetes.io/name"      = "playit"
    "app.kubernetes.io/component" = "tunnel"
  })
}

resource "kubernetes_namespace_v1" "mineops" {
  metadata {
    name = var.namespace

    labels = local.common_labels
  }
}

resource "kubernetes_persistent_volume_v1" "minecraft_data" {
  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      spec[0].capacity,
    ]
  }

  metadata {
    name = var.minecraft_pv_name

    labels = local.minecraft_labels
  }

  spec {
    access_modes                     = ["ReadWriteOnce"]
    persistent_volume_reclaim_policy = "Retain"
    storage_class_name               = "mineops-hostpath"

    capacity = {
      storage = local.cfg_storage_size
    }

    claim_ref {
      name      = "minecraft-data"
      namespace = kubernetes_namespace_v1.mineops.metadata[0].name
    }

    persistent_volume_source {
      host_path {
        path = local.cfg_storage_host_path
        type = "DirectoryOrCreate"
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim_v1" "minecraft_data" {
  wait_until_bound = false

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      spec[0].resources[0].requests,
    ]
  }

  metadata {
    name      = "minecraft-data"
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.minecraft_labels
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = "mineops-hostpath"
    volume_name        = kubernetes_persistent_volume_v1.minecraft_data.metadata[0].name

    resources {
      requests = {
        storage = local.cfg_storage_size
      }
    }
  }
}

resource "kubernetes_deployment_v1" "minecraft" {
  lifecycle {
    ignore_changes = [
      spec[0].replicas,
    ]
  }

  metadata {
    name      = "minecraft"
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.minecraft_labels
  }

  spec {
    replicas = var.minecraft_replicas

    strategy {
      type = "Recreate"
    }

    selector {
      match_labels = {
        "app.kubernetes.io/name"     = "minecraft"
        "app.kubernetes.io/instance" = var.instance_name
      }
    }

    template {
      metadata {
        labels = local.minecraft_labels
      }

      spec {
        init_container {
          name              = "minecraft-data-permissions"
          image             = var.minecraft_image
          image_pull_policy = "IfNotPresent"
          command           = ["/bin/sh", "-c"]
          args              = ["chown -R 1000:1000 /data && chmod -R u+rwX,g+rwX /data"]

          security_context {
            run_as_user  = 0
            run_as_group = 0
          }

          volume_mount {
            name       = "minecraft-data"
            mount_path = "/data"
          }
        }

        container {
          name              = "minecraft"
          image             = var.minecraft_image
          image_pull_policy = "IfNotPresent"

          port {
            name           = "minecraft"
            container_port = 25565
            protocol       = "TCP"
          }

          port {
            name           = "query"
            container_port = var.minecraft_query_port
            protocol       = "UDP"
          }

          resources {
            requests = {
              cpu    = local.cfg_minecraft_cpu_request
              memory = local.cfg_minecraft_memory_request
            }

            limits = {
              cpu    = local.cfg_minecraft_cpu_limit
              memory = local.cfg_minecraft_memory_limit
            }
          }

          env {
            name  = "EULA"
            value = "TRUE"
          }

          env {
            name  = "TZ"
            value = var.mineops_time_zone
          }

          env {
            name  = "TYPE"
            value = local.cfg_minecraft_type
          }

          env {
            name  = "VERSION"
            value = local.cfg_minecraft_version
          }

          env {
            name  = "MEMORY"
            value = local.cfg_minecraft_memory
          }

          env {
            name  = "ONLINE_MODE"
            value = upper(tostring(local.cfg_minecraft_online_mode))
          }

          env {
            name  = "DIFFICULTY"
            value = local.cfg_minecraft_difficulty
          }

          env {
            name  = "MODE"
            value = local.cfg_minecraft_mode
          }

          env {
            name  = "ENABLE_ROLLING_LOGS"
            value = "true"
          }

          env {
            name  = "CREATE_CONSOLE_IN_PIPE"
            value = "true"
          }

          env {
            name  = "ENABLE_QUERY"
            value = tostring(var.minecraft_query_enabled)
          }

          env {
            name  = "ENABLE_RCON"
            value = "false"
          }

          env {
            name  = "QUERY_PORT"
            value = tostring(var.minecraft_query_port)
          }

          env {
            name  = "MAX_PLAYERS"
            value = tostring(local.cfg_minecraft_max_players)
          }

          env {
            name  = "SEED"
            value = tostring(local.cfg_minecraft_seed)
          }

          env {
            name  = "OPS"
            value = local.cfg_minecraft_ops
          }

          env {
            name  = "OVERRIDE_SERVER_PROPERTIES"
            value = "true"
          }

          volume_mount {
            name       = "minecraft-data"
            mount_path = "/data"
          }
        }

        volume {
          name = "minecraft-data"

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim_v1.minecraft_data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "minecraft" {
  wait_for_load_balancer = false

  metadata {
    name      = "minecraft"
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.minecraft_labels
  }

  spec {
    type = var.minecraft_service_type

    selector = {
      "app.kubernetes.io/name"     = "minecraft"
        "app.kubernetes.io/instance" = var.instance_name
    }

    port {
      name        = "minecraft"
      port        = 25565
      target_port = 25565
      protocol    = "TCP"
    }
  }
}

resource "kubernetes_service_v1" "minecraft_query" {
  wait_for_load_balancer = false

  metadata {
    name      = "minecraft-query"
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.minecraft_query_labels
  }

  spec {
    type = "ClusterIP"

    selector = {
      "app.kubernetes.io/name"     = "minecraft"
        "app.kubernetes.io/instance" = var.instance_name
    }

    port {
      name        = "query"
      port        = var.minecraft_query_port
      target_port = var.minecraft_query_port
      protocol    = "UDP"
    }
  }
}

resource "kubernetes_secret_v1" "playit" {
  metadata {
    name      = var.playit_secret_name
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.playit_labels
  }

  type = "Opaque"

  data = {
    (var.playit_secret_key) = var.playit_secret_value
  }

  lifecycle {
    ignore_changes = [data]
  }
}

resource "kubernetes_deployment_v1" "playit" {
  depends_on = [kubernetes_secret_v1.playit]

  lifecycle {
    ignore_changes = [
      spec[0].template[0].metadata[0].annotations["kubectl.kubernetes.io/restartedAt"],
    ]
  }

  metadata {
    name      = "playit"
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.playit_labels
  }

  spec {
    replicas = var.playit_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name"     = "playit"
        "app.kubernetes.io/instance" = var.instance_name
      }
    }

    template {
      metadata {
        labels = local.playit_labels
      }

      spec {
        container {
          name              = "playit"
          image             = var.playit_image
          image_pull_policy = "IfNotPresent"

          resources {
            requests = {
              cpu    = var.playit_cpu_request
              memory = var.playit_memory_request
            }

            limits = {
              cpu    = var.playit_cpu_limit
              memory = var.playit_memory_limit
            }
          }

          env {
            name = "SECRET_KEY"

            value_from {
              secret_key_ref {
                name = var.playit_secret_name
                key  = var.playit_secret_key
              }
            }
          }

          env {
            name  = "TZ"
            value = var.mineops_time_zone
          }
        }

        container {
          name              = "minecraft-local-proxy"
          image             = var.playit_image
          image_pull_policy = "IfNotPresent"

          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            cat > /tmp/minecraft-forward <<'EOF'
            #!/bin/sh
            exec nc minecraft 25565
            EOF
            chmod +x /tmp/minecraft-forward
            exec nc -lk -p 25565 -e /tmp/minecraft-forward
          EOT
          ]

          port {
            name           = "minecraft"
            container_port = 25565
            protocol       = "TCP"
          }

          env {
            name  = "TZ"
            value = var.mineops_time_zone
          }

          resources {
            requests = {
              cpu    = "10m"
              memory = "16Mi"
            }

            limits = {
              cpu    = "100m"
              memory = "64Mi"
            }
          }
        }
      }
    }
  }
}
