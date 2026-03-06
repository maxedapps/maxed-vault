# MaxedVault Monorepo

Bun-native monorepo for a local secrets vault system.

This repository ships a single unified binary: `maxedvault`.
That binary can run both roles:

- Server
- Client CLI

## Workspace Layout

- `apps/app` — unified binary entrypoint (`@maxed-vault/app`)
- `apps/server` — server implementation (`@maxed-vault/server`)
- `apps/client` — client CLI implementation (`@maxed-vault/client`)

## How It Works

1. Start the server with `maxedvault server`.
2. Configure the client once with `maxedvault init`.
3. Bind a workspace to a project with `maxedvault project use <slug>`.
4. Use `secret`, `env`, and `run` commands without repeating the project each time.

Secrets are encrypted at rest in SQLite and decrypted only when returned by the local server.

## Encryption Model

- KDF: `PBKDF2-SHA256`
- Iterations: `600000`
- Per-vault random salt stored in `vault_meta`
- Cipher: `AES-256-GCM`
- Per-secret random IV (12 bytes)
- Stored payload columns: `encrypted_value`, `iv`
- New vaults store an encrypted verifier so wrong passphrases fail fast on startup

## Local Files

### Server DB location

Default when `VAULT_DB_PATH` is unset:

- macOS: `~/Library/Application Support/maxedvault/vault.db`
- Linux: `$XDG_DATA_HOME/maxedvault/vault.db` or `~/.local/share/maxedvault/vault.db`

SQLite sidecar files are created next to the DB:

- `vault.db-wal`
- `vault.db-shm`

### Client config

Global config:

- `~/.maxedvault/config.json`
- shape: `{ "serverUrl": "http://localhost:8420" }`

Workspace config:

- `.maxedvault/config.json`
- shape: `{ "project": "infographics" }`

Project resolution order for scoped commands:

1. `--project <slug>`
2. `MAXEDVAULT_PROJECT`
3. nearest `.maxedvault/config.json` found by walking upward from the current directory

## Install & Verify

```bash
bun install
bun run check
```

## Run From Source

```bash
cd apps/app
```

Start the server:

```bash
bun run src/index.ts server
bun run src/index.ts server start
bun run src/index.ts server run
```

Bind host examples:

```bash
# default: all interfaces
bun run src/index.ts server --passphrase-file /absolute/path/passphrase.txt

# local-only
bun run src/index.ts server --host 127.0.0.1 --passphrase-file /absolute/path/passphrase.txt

# specific Tailscale IP
bun run src/index.ts server --host 100.64.0.10 --passphrase-file /absolute/path/passphrase.txt
```

Configure the client:

```bash
bun run src/index.ts init --server http://localhost:8420
```

Typical flow:

```bash
bun run src/index.ts project create infographics
bun run src/index.ts project use infographics
echo "super-secret" | bun run src/index.ts secret set WEBHOOK_SECRET
bun run src/index.ts secret get WEBHOOK_SECRET
bun run src/index.ts env
bun run src/index.ts run -- node app.js
bun run src/index.ts status
```

## CLI Reference

Binary: `maxedvault`

### Global help

- `maxedvault help`
- `maxedvault help server`
- `maxedvault help project`
- `maxedvault help secret`
- `maxedvault --help`
- `maxedvault -h`

### Server commands

- `maxedvault server`
- `maxedvault server start`
- `maxedvault server run`

Server flags:

- `--host <value>`
- `--host=<value>`
- `--passphrase <value>`
- `--passphrase=<value>`
- `--passphrase-file <path>`
- `--passphrase-file=<path>`

Passphrase precedence:

1. CLI flags
2. `VAULT_PASSPHRASE` or `VAULT_PASSPHRASE_FILE`
3. interactive prompt

Notes:

- Default bind host is `0.0.0.0` (all interfaces), not `localhost`
- Set `VAULT_HOST` or `--host` to restrict the bind address
- New vault creation emits a weak-passphrase warning when the chosen passphrase looks weak

### Client commands

#### Setup and status

- `maxedvault init [--server <url>]`
- `maxedvault status`

#### Project commands

- `maxedvault project create <slug>`
- `maxedvault project list`
- `maxedvault project use <slug>`
- `maxedvault project current`
- `maxedvault project clear`

#### Secret commands

- `maxedvault secret set <name> [--project <slug>]`
- `maxedvault secret get <name> [--project <slug>]`
- `maxedvault secret list [prefix] [--project <slug>]`
- `maxedvault secret remove <name> [--project <slug>]`

#### Env and run

- `maxedvault env [--project <slug>]`
- `maxedvault run [--project <slug>] -- <command> [args...]`

Validation rules:

- project slug: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- secret name: `^[A-Za-z_][A-Za-z0-9_]*$`

### `init` URL resolution behavior

`maxedvault init` accepts:

- full URL (`http://...` or `https://...`) and stores it directly
- host or host:port without scheme:
  - tries `https://<input>/health`
  - then tries `http://<input>/health`
  - stores the first reachable server

## Loading Secrets Into Processes

Bind the workspace once:

```bash
maxedvault project use infographics
```

Print one secret:

```bash
maxedvault secret get WEBHOOK_SECRET
```

Export all secrets into the current shell:

```bash
eval "$(maxedvault env)"
```

Run one process with injected secrets:

```bash
maxedvault run -- node app.js
```

Override project selection explicitly:

```bash
maxedvault run --project infographics -- bun run dev
```

## Server Environment Variables

- `VAULT_HOST` (default `0.0.0.0`)
- `VAULT_PORT` (default `8420`)
- `VAULT_DB_PATH`
- `XDG_DATA_HOME`
- `VAULT_PASSPHRASE`
- `VAULT_PASSPHRASE_FILE`

## HTTP API

Base URL = configured server URL, for example `http://localhost:8420`

- `GET /health`
- `POST /projects`
- `GET /projects`
- `GET /projects/:project`
- `GET /projects/:project/secrets?prefix=<prefix>`
- `GET /projects/:project/secrets/:name`
- `PUT /projects/:project/secrets/:name`
- `DELETE /projects/:project/secrets/:name`
- `GET /projects/:project/env`

Bodies:

- `POST /projects`: `{ "name": "<slug>" }`
- `PUT /projects/:project/secrets/:name`: `{ "value": "<secret>" }`

## Build (Single Binary)

From repo root:

```bash
bun run build:bin
bun run build:bin:prod
bun run build:bin:linux-x64
bun run build:bin:darwin-arm64
```

Outputs:

- `apps/app/dist/maxedvault`
- `apps/app/dist/maxedvault-linux-x64`
- `apps/app/dist/maxedvault-darwin-arm64`

Run the compiled binary:

```bash
./apps/app/dist/maxedvault help
./apps/app/dist/maxedvault server
./apps/app/dist/maxedvault init
```

## Repository Scripts

### Root

- `bun run test`
- `bun run check`
- `bun run build:bin`
- `bun run build:bin:prod`
- `bun run build:bin:linux-x64`
- `bun run build:bin:darwin-arm64`

### apps/app

- `bun run dev`
- `bun run build:bin`
- `bun run build:bin:prod`
- `bun run build:bin:linux-x64`
- `bun run build:bin:darwin-arm64`
- `bun run test`
- `bun run test:watch`
- `bun run check`

### apps/server

- `bun run dev`
- `bun run start`
- `bun run test`
- `bun run test:watch`
- `bun run check`

### apps/client

- `bun run dev`
- `bun run test`
- `bun run test:watch`
- `bun run check`
