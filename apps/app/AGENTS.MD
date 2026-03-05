# AGENTS.MD (App)

## Scope
Applies to `apps/app` only.

## App Focus
- Provide the unified MaxedVault binary entrypoint.
- Route subcommands to server or client behavior with minimal glue logic.
- Keep implementation Bun-native.

## Output and Change Precision
- Keep dispatch logic explicit and predictable.
- Avoid duplicating client/server business logic in this package.
- Prefer thin orchestration over feature re-implementation.
