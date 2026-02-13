# AGENTS.MD (Server)

## Scope
Applies to `apps/server` only.

## Server Focus
- Build and maintain server-side vault APIs and storage logic.
- Keep implementation Bun-native.
- Do not introduce Elysia unless explicitly requested.

## Bun API Preferences
- Prefer `Bun.serve` for HTTP server behavior.
- Prefer `bun:sqlite` for local SQLite operations.
- Prefer `Bun.file` for file reads/writes when needed.

## Output and Change Precision
- Implement exactly what is requested.
- Keep changes small and localized.
- Avoid client/CLI changes unless task requires cross-package updates.

## Security Rules
- Never hardcode secrets, tokens, or private keys.
- Avoid logging secret values.
- Keep authentication and secret storage defaults strict.
