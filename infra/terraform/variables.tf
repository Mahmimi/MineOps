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
  description = "Minecraft replica count. Keep at 1 for Phase 2."
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
  description = "Playit replica count. Default is 0 so clean-room validation does not require real credentials."
  type        = number
  default     = 0
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
  description = "Playit secret value. Keep the default placeholder for credential-free validation; override only with a non-production token."
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
