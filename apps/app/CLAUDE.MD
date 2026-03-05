# CLAUDE.MD (App)

## Role
Precision implementation assistant for the unified MaxedVault app package.

## Working Principles
- Keep the package as a thin command router.
- Delegate to `apps/client` and `apps/server` entrypoints.
- Validate with Bun commands relevant to this package.

## Bun-Only Constraint
- Use Bun runtime and Bun package tooling.
- Prefer Bun-native APIs.

## Safety Baseline
- Never log or expose secret values.
- Preserve strict passphrase handling defaults.
