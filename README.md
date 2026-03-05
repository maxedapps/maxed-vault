# MaxedVault Monorepo

Bun-native monorepo for a local secrets vault system.

This repository ships a **single unified binary**: `maxedvault`.
That binary can run both roles:

- **Server** (long-running process)
- **Client CLI** (short-lived commands)

---

## Workspace Layout

- `apps/app` — unified binary entrypoint (`@maxed-vault/app`)
- `apps/server` — server implementation (`@maxed-vault/server`)
- `apps/client` — client command implementation (`@maxed-vault/client`)
- root — workspace config and scripts

---

## How the App Works

1. Start server via unified binary (`maxedvault server ...`).
2. Server derives an in-memory master key from a passphrase.
3. Secret values are encrypted and stored in SQLite.
4. Client commands call server HTTP endpoints to manage projects/secrets.
5. Secrets can be exported or injected into child processes (`env` / `run`).

### Encryption model

- KDF: **PBKDF2-SHA256**
- Iterations: **600,000**
- Cipher: **AES-256-GCM**
- Per-secret random IV (12 bytes)
- Stored payload columns: `encrypted_value`, `iv` (base64)

Passphrase role:

- Required at server startup
- Not persisted by app code
- Must match previous passphrase to decrypt existing vault data

---

## Local Files

### Server DB location

Default (when `VAULT_DB_PATH` is unset):

- macOS: `~/Library/Application Support/maxedvault/vault.db`
- Linux: `$XDG_DATA_HOME/maxedvault/vault.db` or `~/.local/share/maxedvault/vault.db`

SQLite WAL sidecar files are created next to DB:

- `vault.db-wal`
- `vault.db-shm`

### Client config location

- `~/.maxedvault/config.json` (file mode `0600`)

---

## Install & Verify

```bash
bun install
bun run test
# or
bun run check
```

---

## Run From Source (Unified App)

```bash
cd apps/app
```

Start server:

```bash
bun run src/index.ts server
# equivalent forms:
bun run src/index.ts server start
bun run src/index.ts server run
```

Passphrase examples:

```bash
# direct passphrase
bun run src/index.ts server --passphrase "your-strong-passphrase"

# passphrase file
bun run src/index.ts server --passphrase-file /absolute/path/passphrase.txt
```

Initialize client config:

```bash
# prompt mode (recommended)
bun run src/index.ts init

# explicit URL
bun run src/index.ts init --server http://localhost:8420
```

Typical flow:

```bash
bun run src/index.ts project create infographics
echo "super-secret" | bun run src/index.ts set WEBHOOK_SECRET --project infographics
bun run src/index.ts get WEBHOOK_SECRET --project infographics
bun run src/index.ts env --project infographics
bun run src/index.ts run --project infographics -- npm start
bun run src/index.ts status
```

---

## Complete Command + Flag Reference

Binary: `maxedvault`

> When running from source, replace `maxedvault` with `bun run src/index.ts` from `apps/app`.

### Global help

- `maxedvault help`
- `maxedvault help server`
- `maxedvault --help`
- `maxedvault -h`

### Server commands

- `maxedvault server`
- `maxedvault server start`
- `maxedvault server run`

Server flags:

- `--passphrase <value>`
- `--passphrase=<value>`
- `--passphrase-file <path>`
- `--passphrase-file=<path>`

Rules:

- Use **either** passphrase flag **or** passphrase-file flag, not both.
- If no passphrase source is provided, interactive prompt is used.

### Client commands

| Command | Flags/options | Description |
|---|---|---|
| `init` | optional: `--server <url-or-host>` | Save server URL in local config |
| `status` | none | Print configured server and health status |
| `project create <slug>` | none | Create project |
| `project ls` | none | List projects |
| `set <name>` | required: `--project <slug>` | Create/update secret |
| `get <name>` | required: `--project <slug>` | Print one secret value |
| `ls [prefix]` | required: `--project <slug>` | List secret names (optional prefix) |
| `rm <name>` | required: `--project <slug>` | Delete secret |
| `env` | required: `--project <slug>` | Print shell exports for all project secrets |
| `run --project <slug> -- <command> [args...]` | required: `--project <slug>` and `--` separator | Run command with project secrets injected into env |

Validation rules:

- project slug: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- secret name: `^[A-Za-z_][A-Za-z0-9_]*$`

### `init` URL resolution behavior

`maxedvault init` (or `init --server ...`) accepts:

- full URL (`http://...` / `https://...`) → saved as given (normalized)
- host/IP without scheme (`localhost:8420`, `127.0.0.1:8420`, etc.) →
  - tries `https://<input>/health`
  - then tries `http://<input>/health`
  - saves the first reachable one
  - errors if neither is reachable

---

## Passphrase Sources (Server)

Supported sources, in precedence order:

1. CLI flags:
   - `--passphrase ...`
   - `--passphrase-file ...`
2. Environment variables:
   - `VAULT_PASSPHRASE`
   - `VAULT_PASSPHRASE_FILE`
3. Interactive prompt

Notes:

- `--passphrase` and `--passphrase-file` are mutually exclusive.
- `VAULT_PASSPHRASE` and `VAULT_PASSPHRASE_FILE` are mutually exclusive.
- Passphrase file content has trailing newlines stripped.

---

## Output Streams

- Normal/success output is written to **stdout**.
- Errors are written to **stderr**.

This includes command confirmations like create/update/delete/configured.

---

## Load Secrets Into Processes

Single secret:

```bash
export WEBHOOK_SECRET="$(maxedvault get WEBHOOK_SECRET --project infographics)"
```

All secrets in current shell:

```bash
eval "$(maxedvault env --project infographics)"
```

All secrets for one child process:

```bash
maxedvault run --project infographics -- npm start
```

---

## Server Environment Variables

- `VAULT_PORT` (default `8420`)
- `VAULT_DB_PATH` (override SQLite DB path)
- `XDG_DATA_HOME` (Linux DB base path when `VAULT_DB_PATH` is unset)
- `VAULT_PASSPHRASE`
- `VAULT_PASSPHRASE_FILE`

---

## HTTP API

Base URL = configured server URL (example: `http://localhost:8420`)

- `GET /health`
- `POST /projects`
- `GET /projects`
- `GET /projects/:project/secrets?prefix=<prefix>`
- `GET /projects/:project/secrets/:name`
- `PUT /projects/:project/secrets/:name`
- `DELETE /projects/:project/secrets/:name`
- `GET /projects/:project/secrets-env`

Bodies:

- `POST /projects`: `{ "name": "<slug>" }`
- `PUT /projects/:project/secrets/:name`: `{ "value": "<secret>" }`

---

## Build (Single Binary)

From repo root:

```bash
# local platform
bun run build:bin

# local platform, production-oriented
bun run build:bin:prod

# cross-target
bun run build:bin:linux-x64
bun run build:bin:darwin-arm64
```

Outputs:

- `apps/app/dist/maxedvault`
- `apps/app/dist/maxedvault-linux-x64`
- `apps/app/dist/maxedvault-darwin-arm64`

Run compiled binary:

```bash
./apps/app/dist/maxedvault help
./apps/app/dist/maxedvault server
./apps/app/dist/maxedvault init
```

---

## Repository Scripts

### Root scripts

- `bun run test`
- `bun run check`
- `bun run build:bin`
- `bun run build:bin:prod`
- `bun run build:bin:linux-x64`
- `bun run build:bin:darwin-arm64`

### `apps/app` scripts

- `bun run dev`
- `bun run build:bin`
- `bun run build:bin:prod`
- `bun run build:bin:linux-x64`
- `bun run build:bin:darwin-arm64`
- `bun run test`
- `bun run test:watch`
- `bun run check`

### `apps/server` scripts

- `bun run dev`
- `bun run start`
- `bun run test`
- `bun run test:watch`
- `bun run check`

### `apps/client` scripts

- `bun run dev`
- `bun run test`
- `bun run test:watch`
- `bun run check`

---

## Security Notes

- Avoid exposing passphrases in shell history on shared systems.
- Prefer interactive passphrase input where possible.
- Keep DB/config files protected by OS permissions.
- Server currently has no auth boundary beyond deployment/network setup; run in trusted environments.
