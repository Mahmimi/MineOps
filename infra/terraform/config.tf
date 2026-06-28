locals {
  cfg_storage_size             = var.minecraft_storage_size
  cfg_storage_host_path        = var.minecraft_host_path
  cfg_minecraft_type           = var.minecraft_type
  cfg_minecraft_version        = var.minecraft_version
  cfg_minecraft_memory         = var.minecraft_memory
  cfg_minecraft_online_mode    = var.minecraft_online_mode
  cfg_minecraft_max_players      = var.minecraft_max_players
  cfg_minecraft_spawn_protection = var.minecraft_spawn_protection
  cfg_minecraft_seed           = var.minecraft_seed
  cfg_minecraft_difficulty     = var.minecraft_difficulty
  cfg_minecraft_mode           = var.minecraft_mode
  cfg_minecraft_ops            = var.minecraft_ops
  cfg_minecraft_cpu_request    = var.minecraft_cpu_request
  cfg_minecraft_memory_request = var.minecraft_memory_request
  cfg_minecraft_cpu_limit      = var.minecraft_cpu_limit
  cfg_minecraft_memory_limit   = var.minecraft_memory_limit

  cfg_backup_enabled  = var.backup_enabled
  cfg_backup_schedule = var.backup_schedule
  cfg_backup_mode     = var.backup_mode
  cfg_backup_limit    = var.backup_limit
}