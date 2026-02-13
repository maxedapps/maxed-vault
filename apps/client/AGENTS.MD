# AGENTS.MD (Client)

## Scope
Applies to `apps/client` only.

## Client Focus
- Build and maintain CLI/client behavior for vault usage.
- Keep shell-facing output deterministic and minimal.
- Avoid server changes unless explicitly required.

## Bun API Preferences
- Prefer Bun runtime and Bun command execution.
- Prefer Bun-native process APIs (for example `Bun.spawn`) over Node child-process wrappers.
- Keep dependencies minimal.

## Output Precision
- CLI output should be concise and exact.
- For machine-consumed output, avoid extra text.
- Preserve backward-compatible command behavior unless explicitly changed.

## Security Rules
- Never print or persist secret values unnecessarily.
- Avoid accidental secret leakage in errors and debug output.
