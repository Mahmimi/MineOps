# First Server

After `mineops init`, MineOps should expose one instance with four platform services:

- Minecraft
- Discord bot
- Playit
- Backup

## Confirm The Instance Graph

```powershell
mineops config graph
```

Expected shape:

```text
survival -> namespace=mineops-survival -> minecraft, discord, playit, backup
```

## Confirm Runtime Health

```powershell
mineops status --instance survival
mineops doctor --instance survival
mineops health --instance survival
```

## Inspect Player Access

```powershell
mineops playit --instance survival
```

Playit is only considered ready when:

- the Playit deployment is ready
- the Minecraft service has endpoints

If Minecraft is scaled to zero, the tunnel agent may still be up while the public join path remains blocked.

## Create A Manual Backup

```powershell
mineops backup --instance survival
mineops backups --instance survival
```

## Common First Changes

- Update the Minecraft version with `mineops update minecraft <version> --instance survival`
- Add another instance in `mineops.yaml`
- Configure Discord admins in `services.discord.admins`

Next: [Commands](../user-guide/commands.md)
