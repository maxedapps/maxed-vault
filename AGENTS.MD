# AGENTS.MD

## Purpose
This repository contains the MaxedVault monorepo for a secrets vault system.
Scope currently is project initialization and incremental implementation.

## Global Working Rules
- Be precise and focused; solve only the requested task.
- Keep responses short, direct, and actionable.
- Do not add unrelated features, files, or refactors.
- Prefer minimal changes with clear intent.
- Ask for clarification only when a blocking ambiguity exists.
- Keep README.md file updated to accurately describe the app and its features / commands / flags

## Runtime and Tooling Rules (Bun First)
- Use Bun as the default runtime, package manager, and task runner.
- Use `bun install`, `bun run`, `bun test`, `bun build`.
- Prefer Bun-native APIs when suitable (for example `Bun.serve`, `Bun.file`, `Bun.spawn`, `bun:sqlite`).
- Do not introduce Node/npm/yarn/pnpm workflows unless explicitly requested.
- Keep dependencies minimal and justify new ones.

## Server Constraints
- Server stack must remain Bun-only unless the user explicitly changes this requirement.
- Do not add Elysia by default.

## Security and Secrets
- Never hardcode secrets or tokens in source files.
- Use environment variables and documented local setup.
- Treat secret handling and storage behavior as security-sensitive by default.

## Monorepo Boundaries
- `apps/server` is backend/server runtime scope.
- `apps/client` is CLI/client scope.
- `apps/app` is the unified single-binary entrypoint/orchestration scope.
- Shared conventions should be documented at the root before duplication.
