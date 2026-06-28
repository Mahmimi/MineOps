# ADR Index

Architecture decision records describe stable architectural choices that outlive individual implementation details.

## Records

- [0001: MineOpsConfig as the Internal Source of Truth](0001-mineops-config-as-ssot.md)

## Current Scope

The ADR set is intentionally small. The most important accepted decision today is the separation between:

- external configuration inputs
- immutable internal domain config
- generated artifacts consumed by infrastructure

That decision anchors the rest of the documentation set.
