output "namespace" {
  description = "Configured MineOps namespace name."
  value       = kubernetes_namespace_v1.mineops.metadata[0].name
}

output "minecraft_pvc_name" {
  description = "Minecraft data PersistentVolumeClaim name."
  value       = kubernetes_persistent_volume_claim_v1.minecraft_data.metadata[0].name
}

output "minecraft_service_name" {
  description = "Minecraft Service name."
  value       = kubernetes_service_v1.minecraft.metadata[0].name
}

output "minecraft_query_service_name" {
  description = "Internal Minecraft Query Protocol Service name."
  value       = kubernetes_service_v1.minecraft_query.metadata[0].name
}

output "minecraft_query_port" {
  description = "Minecraft Query Protocol UDP port."
  value       = var.minecraft_query_port
}

output "playit_deployment_name" {
  description = "Playit Deployment name."
  value       = kubernetes_deployment_v1.playit.metadata[0].name
}

output "playit_secret_name" {
  description = "Playit Secret name managed by Terraform with placeholder data by default."
  value       = kubernetes_secret_v1.playit.metadata[0].name
}

output "backup_cronjob_name" {
  description = "Minecraft backup CronJob name."
  value       = kubernetes_cron_job_v1.minecraft_backup.metadata[0].name
}

output "backup_mode" {
  description = "Configured Minecraft backup retention mode."
  value       = var.backup_mode
}

output "backup_host_path" {
  description = "Configured host backup path."
  value       = var.backup_host_path
}
