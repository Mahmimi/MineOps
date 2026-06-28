# Testing

MineOps currently relies on syntax checks, configuration validation, and infrastructure validation more than on a large automated unit-test suite.

## Current Checks

CLI syntax:

```powershell
npm --prefix apps/mineops-cli run check
```

Discord bot syntax:

```powershell
npm --prefix apps/discord-bot run check
```

Terraform validation:

```powershell
terraform -chdir=infra/terraform validate
```

Configuration validation:

```powershell
mineops validate
mineops config validate --all
```

Operational verification:

```powershell
mineops init
mineops doctor --all
mineops status --all
```

## What To Test When Changing Architecture

- adapter behavior
- schema changes
- generated artifact contents
- instance-aware command behavior
- per-instance namespace isolation

## Current Gaps

- no formal unit-test harness for config generation
- no dedicated integration-test suite for multi-instance flows
- no automated doc link checker wired into the repo

Those are real gaps and should be treated as documentation debt, not hidden.
