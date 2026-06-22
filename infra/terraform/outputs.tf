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

output "playit_deployment_name" {
  description = "Playit Deployment name."
  value       = kubernetes_deployment_v1.playit.metadata[0].name
}

output "playit_secret_name" {
  description = "Playit Secret name managed by Terraform with placeholder data by default."
  value       = kubernetes_secret_v1.playit.metadata[0].name
}
