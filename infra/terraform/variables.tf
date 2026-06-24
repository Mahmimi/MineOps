variable "kubeconfig_path" {
  description = "Path to the kubeconfig file for the target MineOps Kubernetes cluster."
  type        = string
  default     = "~/.kube/config"
}

variable "namespace" {
  description = "Kubernetes namespace reserved for MineOps platform resources."
  type        = string
  default     = "mineops"
}

variable "minecraft_image" {
  description = "Minecraft server image."
  type        = string
  default     = "itzg/minecraft-server"
}

variable "minecraft_replicas" {
  description = "Minecraft replica count. Keep at 1 for a single active server."
  type        = number
  default     = 1
}

variable "minecraft_storage_size" {
  description = "Requested storage for Minecraft data."
  type        = string
  default     = "20Gi"
}

variable "minecraft_memory" {
  description = "Minecraft JVM memory setting passed to the container."
  type        = string
  default     = "4G"
}

variable "minecraft_type" {
  description = "Minecraft server type for itzg/minecraft-server."
  type        = string
  default     = "PAPER"
}

variable "minecraft_version" {
  description = "Minecraft version for itzg/minecraft-server."
  type        = string
  default     = "LATEST"
}

variable "minecraft_ops" {
  description = "Comma-separated Minecraft operator usernames."
  type        = string
  default     = "Jiranuwat"
}

variable "minecraft_seed" {
  description = "Minecraft world seed used for new worlds. Existing migrated worlds keep their own data."
  type        = string
  default     = "5063885805507972583"
}

variable "minecraft_service_type" {
  description = "Service type for Minecraft traffic on k3d."
  type        = string
  default     = "LoadBalancer"
}

variable "minecraft_query_enabled" {
  description = "Enable the Minecraft Query Protocol for read-only player queries."
  type        = bool
  default     = true
}

variable "minecraft_query_port" {
  description = "UDP port used by the Minecraft Query Protocol."
  type        = number
  default     = 25565
}

variable "minecraft_cpu_request" {
  description = "CPU request for the Minecraft container."
  type        = string
  default     = "1000m"
}

variable "minecraft_cpu_limit" {
  description = "CPU limit for the Minecraft container."
  type        = string
  default     = "3000m"
}

variable "minecraft_memory_request" {
  description = "Memory request for the Minecraft container."
  type        = string
  default     = "5Gi"
}

variable "minecraft_memory_limit" {
  description = "Memory limit for the Minecraft container."
  type        = string
  default     = "6Gi"
}

variable "playit_image" {
  description = "Playit agent image."
  type        = string
  default     = "ghcr.io/playit-cloud/playit-agent:0.17"
}

variable "playit_replicas" {
  description = "Playit replica count for the tunnel agent."
  type        = number
  default     = 1
}

variable "playit_secret_name" {
  description = "Name of the Kubernetes Secret containing the Playit secret key."
  type        = string
  default     = "playit-secret"
}

variable "playit_secret_key" {
  description = "Key inside the Playit Secret that stores the Playit secret value."
  type        = string
  default     = "secret-key"
}

variable "playit_secret_value" {
  description = "Playit secret value. MineOps CLI and scripts inject the real value from .env during normal installs."
  type        = string
  default     = "replace-with-non-production-playit-secret"
  sensitive   = true
}

variable "playit_cpu_request" {
  description = "CPU request for the Playit container."
  type        = string
  default     = "50m"
}

variable "playit_cpu_limit" {
  description = "CPU limit for the Playit container."
  type        = string
  default     = "250m"
}

variable "playit_memory_request" {
  description = "Memory request for the Playit container."
  type        = string
  default     = "64Mi"
}

variable "playit_memory_limit" {
  description = "Memory limit for the Playit container."
  type        = string
  default     = "256Mi"
}

variable "backup_enabled" {
  description = "Enable the Minecraft backup CronJob schedule. When false, the CronJob exists but is suspended."
  type        = bool
  default     = true
}

variable "backup_schedule" {
  description = "Cron expression for automatic Minecraft backups."
  type        = string
  default     = "*/30 * * * *"
}

variable "backup_mode" {
  description = "Backup retention mode: replace, append, or append_with_limit."
  type        = string
  default     = "append_with_limit"

  validation {
    condition     = contains(["replace", "append", "append_with_limit"], var.backup_mode)
    error_message = "backup_mode must be one of: replace, append, append_with_limit."
  }
}

variable "backup_limit" {
  description = "Maximum retained timestamped backups when backup_mode is append_with_limit."
  type        = number
  default     = 5

  validation {
    condition     = var.backup_limit >= 1
    error_message = "backup_limit must be at least 1."
  }
}

variable "backup_host_path" {
  description = "Host directory for backups. Relative paths are resolved by the local shell before k3d cluster creation and mounted into cluster nodes at /backups."
  type        = string
  default     = "./backups"
}

variable "backup_image" {
  description = "Container image used by the backup CronJob. Must include kubectl and POSIX shell utilities."
  type        = string
  default     = "bitnami/kubectl:latest"
}
