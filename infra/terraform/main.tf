locals {
  common_labels = {
    "app.kubernetes.io/part-of"    = "mineops"
    "app.kubernetes.io/managed-by" = "terraform"
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

resource "kubernetes_persistent_volume_claim_v1" "minecraft_data" {
  wait_until_bound = false

  metadata {
    name      = "minecraft-data"
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.minecraft_labels
  }

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = var.minecraft_storage_size
      }
    }
  }
}

resource "kubernetes_deployment_v1" "minecraft" {
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
        "app.kubernetes.io/name" = "minecraft"
      }
    }

    template {
      metadata {
        labels = local.minecraft_labels
      }

      spec {
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
              cpu    = var.minecraft_cpu_request
              memory = var.minecraft_memory_request
            }

            limits = {
              cpu    = var.minecraft_cpu_limit
              memory = var.minecraft_memory_limit
            }
          }

          env {
            name  = "EULA"
            value = "TRUE"
          }

          env {
            name  = "TYPE"
            value = var.minecraft_type
          }

          env {
            name  = "VERSION"
            value = var.minecraft_version
          }

          env {
            name  = "MEMORY"
            value = var.minecraft_memory
          }

          env {
            name  = "ONLINE_MODE"
            value = "TRUE"
          }

          env {
            name  = "DIFFICULTY"
            value = "normal"
          }

          env {
            name  = "MODE"
            value = "survival"
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
            name  = "QUERY_PORT"
            value = tostring(var.minecraft_query_port)
          }

          env {
            name  = "SEED"
            value = var.minecraft_seed
          }

          env {
            name  = "OPS"
            value = var.minecraft_ops
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
  metadata {
    name      = "minecraft"
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.minecraft_labels
  }

  spec {
    type = var.minecraft_service_type

    selector = {
      "app.kubernetes.io/name" = "minecraft"
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
  metadata {
    name      = "minecraft-query"
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.minecraft_query_labels
  }

  spec {
    type = "ClusterIP"

    selector = {
      "app.kubernetes.io/name" = "minecraft"
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

  metadata {
    name      = "playit"
    namespace = kubernetes_namespace_v1.mineops.metadata[0].name

    labels = local.playit_labels
  }

  spec {
    replicas = var.playit_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "playit"
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
        }
      }
    }
  }
}
