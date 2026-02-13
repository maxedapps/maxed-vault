# MaxedVault Monorepo

Bun-native monorepo scaffold for a secrets vault system.
Current state includes a working server API and CLI client.

## Workspace Layout

- `apps/server` — server package (`@maxed-vault/server`)
- `apps/client` — client/CLI package (`@maxed-vault/client`)
- root — Bun workspace config, shared policies, and repository docs

## Tooling Baseline

- Runtime and package manager: Bun
- Workspace management: Bun workspaces via root `package.json`
- Server framework policy: no Elysia by default

## Current Capabilities

- Server (`apps/server`)
  - `GET /health`
  - `POST /projects`
  - `GET /projects`
  - `GET /projects/:project/secrets?prefix=<prefix>`
  - `GET /projects/:project/secrets/:name`
  - `PUT /projects/:project/secrets/:name`
  - `DELETE /projects/:project/secrets/:name`
  - `GET /projects/:project/secrets-env`
  - SQLite persistence with encrypted secret values (AES-GCM)
- Client (`apps/client`)
  - `maxedvault init --server <url>`
  - `maxedvault project create <slug>`
  - `maxedvault project ls`
  - `maxedvault get <name> --project <slug>`
  - `maxedvault set <name> --project <slug>`
  - `maxedvault ls [prefix] --project <slug>`
  - `maxedvault rm <name> --project <slug>`
  - `maxedvault env --project <slug>`
  - `maxedvault status`

## Quick Start

```bash
bun install

# run tests in all workspace packages
bun run test

# or run package checks
bun run check
```

## Local Run

### Server

```bash
cd apps/server
cp .env.example .env
# update VAULT_PASSPHRASE and optional values
bun run start
```

### Client

```bash
cd apps/client
bun run src/index.ts init --server http://localhost:8420
bun run src/index.ts project create infographics
echo "super-secret" | bun run src/index.ts set WEBHOOK_SECRET --project infographics
bun run src/index.ts get WEBHOOK_SECRET --project infographics
bun run src/index.ts env --project infographics
# load in current shell session
eval "$(bun run src/index.ts env --project infographics)"
bun run src/index.ts status
```

## Build Standalone Binaries

You can compile client and server into single executables with Bun.

### Client

```bash
cd apps/client

# local platform binary
bun run build:bin

# production-oriented build (minify + sourcemap + bytecode)
bun run build:bin:prod

# cross-compile examples
bun run build:bin:linux-x64
bun run build:bin:darwin-arm64
```

### Server

```bash
cd apps/server

# local platform binary
bun run build:bin

# production-oriented build (minify + sourcemap + bytecode)
bun run build:bin:prod

# cross-compile examples
bun run build:bin:linux-x64
bun run build:bin:darwin-arm64
```

This produces binaries in each package `dist` directory.

Security note: compiled binaries still read runtime configuration (for this project, your local `~/.maxedvault/config.json` and current environment). Do not inline secrets at build time.

## Testing

- Root: `bun run test`
- Server only: `bun run --filter @maxed-vault/server test`
- Client only: `bun run --filter @maxed-vault/client test`

## Policy Documents

- Root policy: `AGENTS.MD`, `CLAUDE.MD`
- App policy overlays:
  - `apps/server/AGENTS.MD`, `apps/server/CLAUDE.MD`
  - `apps/client/AGENTS.MD`, `apps/client/CLAUDE.MD`
