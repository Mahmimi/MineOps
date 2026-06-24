locals {
  minecraft_config_path = "${path.module}/../../config/minecraft.yaml"
  minecraft_config      = yamldecode(file(local.minecraft_config_path))

  cfg_minecraft = local.minecraft_config.minecraft
  cfg_world     = local.minecraft_config.world
  cfg_server    = local.minecraft_config.server
  cfg_backup    = local.minecraft_config.backup
  cfg_storage   = try(local.minecraft_config.storage, {})
  cfg_resources = try(local.minecraft_config.resources, {})

  cfg_operators = try(local.minecraft_config.operators, [])

  cfg_storage_size             = try(local.cfg_storage.size, var.minecraft_storage_size)
  cfg_minecraft_type           = try(local.cfg_minecraft.type, var.minecraft_type)
  cfg_minecraft_version        = try(local.cfg_minecraft.version, var.minecraft_version)
  cfg_minecraft_memory         = try(local.cfg_server.memory, var.minecraft_memory)
  cfg_minecraft_online_mode    = try(local.cfg_server.onlineMode, true)
  cfg_minecraft_max_players    = try(local.cfg_server.maxPlayers, 20)
  cfg_minecraft_seed           = try(local.cfg_world.seed, var.minecraft_seed)
  cfg_minecraft_difficulty     = try(local.cfg_world.difficulty, "normal")
  cfg_minecraft_mode           = try(local.cfg_world.mode, "survival")
  cfg_minecraft_ops            = length(local.cfg_operators) > 0 ? join(",", local.cfg_operators) : var.minecraft_ops
  cfg_minecraft_cpu_request    = try(local.cfg_resources.requests.cpu, var.minecraft_cpu_request)
  cfg_minecraft_memory_request = try(local.cfg_resources.requests.memory, var.minecraft_memory_request)
  cfg_minecraft_cpu_limit      = try(local.cfg_resources.limits.cpu, var.minecraft_cpu_limit)
  cfg_minecraft_memory_limit   = try(local.cfg_resources.limits.memory, var.minecraft_memory_limit)

  cfg_backup_enabled  = try(local.cfg_backup.enabled, var.backup_enabled)
  cfg_backup_schedule = try(local.cfg_backup.interval, var.backup_schedule)
  cfg_backup_mode     = try(local.cfg_backup.mode, var.backup_mode)
  cfg_backup_limit    = try(local.cfg_backup.limit, var.backup_limit)
}
