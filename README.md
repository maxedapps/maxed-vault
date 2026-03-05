# MaxedVault Monorepo

Bun-native monorepo for a local secrets vault system with:

- a **server** (`apps/server`) that stores encrypted secrets in SQLite
- a **CLI client** (`apps/client`) to manage projects/secrets and inject them into processes

---

## Workspace Layout

- `apps/server` — server package (`@maxed-vault/server`)
- `apps/client` — client/CLI package (`@maxed-vault/client`)
- root — Bun workspace config + shared scripts

---

## How the App Works (High Level)

1. You start the server and provide a **vault passphrase**.
2. The server derives an in-memory master key from that passphrase.
3. Secret values are encrypted before writing to SQLite.
4. The client talks to server HTTP endpoints to create projects, set/get/list/delete secrets.
5. The client can export secrets as shell env exports (`env`) or run commands with injected env vars (`run`).

### Encryption model

- Key derivation: **PBKDF2-SHA256** (600,000 iterations)
- Encryption: **AES-256-GCM**
- Per-secret random IV (12 bytes)
- Stored in DB as `encrypted_value` + `iv` (base64)

Passphrase role:

- The passphrase is required at startup to derive the master key.
- It is **not persisted** by the app.
- You must use the same passphrase to decrypt existing secrets after restart.

---

## Installation & Basic Checks

```bash
bun install
bun run test
# or
bun run check
```

---

## Run from Source

### 1) Start server

```bash
cd apps/server
cp .env.example .env
bun run start
```

You will be prompted for the passphrase.

Alternative (non-interactive):

```bash
bun run start -- --passphrase "your-strong-passphrase"
# or
bun run start -- --passphrase=your-strong-passphrase
```

### 2) Configure client

```bash
cd apps/client
bun run src/index.ts init --server http://localhost:8420
```

This writes client config to:

- `~/.maxedvault/config.json` (mode `0600`)

### 3) Typical flow

```bash
bun run src/index.ts project create infographics
echo "super-secret" | bun run src/index.ts set WEBHOOK_SECRET --project infographics
bun run src/index.ts get WEBHOOK_SECRET --project infographics
bun run src/index.ts ls --project infographics
bun run src/index.ts env --project infographics
bun run src/index.ts run --project infographics -- npm start
```

---

## CLI Command Reference (All Commands & Flags)

Binary name: `maxedvault`

> When running from source inside `apps/client`, replace `maxedvault` with `bun run src/index.ts`.
> No short flags are currently supported.

### Conventions & validation rules

- **Project slug** must match lowercase slug format: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- **Secret name** must be env-var-safe: `^[A-Za-z_][A-Za-z0-9_]*$`

### Command summary

| Command | Required flags/options | Description |
|---|---|---|
| `init` | `--server <url>` | Save server URL in local config |
| `status` | none | Print configured server + `/health` status |
| `project create <slug>` | none | Create project |
| `project ls` | none | List projects |
| `set <name>` | `--project <slug>` | Create/update a secret value |
| `get <name>` | `--project <slug>` | Print one secret value |
| `ls [prefix]` | `--project <slug>` | List secret names, optionally filtered by prefix |
| `rm <name>` | `--project <slug>` | Delete a secret |
| `env` | `--project <slug>` | Print all secrets as `export KEY='value'` lines |
| `run --project <slug> -- <command> [args...]` | `--project <slug>` + `--` separator | Run command with all project secrets injected into env |

### Detailed usage

#### `maxedvault init --server <url>`

- Required flag: `--server <url>`
- Stores URL in `~/.maxedvault/config.json`

Example:

```bash
maxedvault init --server http://localhost:8420
```

#### `maxedvault status`

- No flags
- Shows configured server and health check result

#### `maxedvault project create <slug>`

- Positional: `<slug>`

Example:

```bash
maxedvault project create infographics
```

#### `maxedvault project ls`

- No flags

#### `maxedvault set <name> --project <slug>`

- Positional: `<name>`
- Required flag: `--project <slug>`
- Value input behavior:
  - if stdin is piped: reads value from stdin
  - if stdin is interactive: prompts `Enter secret value:` and reads input

Examples:

```bash
echo "abc123" | maxedvault set WEBHOOK_SECRET --project infographics
maxedvault set WEBHOOK_SECRET --project infographics
```

#### `maxedvault get <name> --project <slug>`

- Positional: `<name>`
- Required flag: `--project <slug>`
- Writes raw secret value to stdout (pipe-friendly)

Example:

```bash
maxedvault get WEBHOOK_SECRET --project infographics
```

#### `maxedvault ls [prefix] --project <slug>`

- Optional positional: `[prefix]`
- Required flag: `--project <slug>`

Examples:

```bash
maxedvault ls --project infographics
maxedvault ls WEB --project infographics
```

#### `maxedvault rm <name> --project <slug>`

- Positional: `<name>`
- Required flag: `--project <slug>`

#### `maxedvault env --project <slug>`

- Required flag: `--project <slug>`
- Prints shell `export` lines for all project secrets

Example:

```bash
maxedvault env --project infographics
# load into current shell
eval "$(maxedvault env --project infographics)"
```

#### `maxedvault run --project <slug> -- <command> [args...]`

- Required flag: `--project <slug>`
- Required separator: `--`
- Everything after `--` is executed as child command
- Child env = current process env + project secrets

Example:

```bash
maxedvault run --project infographics -- npm start
```

---

## Server Runtime Reference (Flags + Env)

Binary/source entrypoint: `apps/server/src/index.ts`

### Server CLI flags

- `--passphrase <value>`
- `--passphrase=<value>`

If omitted, the server prompts for passphrase interactively.

### Server environment variables

- `VAULT_PORT` (default: `8420`)
- `VAULT_DB_PATH` (absolute/relative path to SQLite DB)
- `XDG_DATA_HOME` (Linux only, used for default DB location when `VAULT_DB_PATH` is unset)

### Default DB location (when `VAULT_DB_PATH` is not set)

- macOS: `~/Library/Application Support/maxedvault/vault.db`
- Linux: `$XDG_DATA_HOME/maxedvault/vault.db` or `~/.local/share/maxedvault/vault.db`

SQLite WAL sidecar files are also created next to DB (`-wal`, `-shm`).

---

## HTTP API Reference

Base URL: configured server (e.g. `http://localhost:8420`)

- `GET /health`
- `POST /projects`
- `GET /projects`
- `GET /projects/:project/secrets?prefix=<prefix>`
- `GET /projects/:project/secrets/:name`
- `PUT /projects/:project/secrets/:name`
- `DELETE /projects/:project/secrets/:name`
- `GET /projects/:project/secrets-env`

Notes:

- `POST /projects` body: `{ "name": "<slug>" }`
- `PUT .../secrets/:name` body: `{ "value": "<secret>" }`

---

## Build Standalone Binaries

### Build from root (recommended)

```bash
# client + server (local platform)
bun run build:bin

# client + server production-oriented build
bun run build:bin:prod

# package-specific wrappers
bun run build:bin:client
bun run build:bin:server
bun run build:bin:client:prod
bun run build:bin:server:prod
```

### Build inside each package

#### Client (`apps/client`)

```bash
bun run build:bin
bun run build:bin:prod
bun run build:bin:linux-x64
bun run build:bin:darwin-arm64
```

Outputs:

- `apps/client/dist/maxedvault`
- `apps/client/dist/maxedvault-linux-x64`
- `apps/client/dist/maxedvault-darwin-arm64`

#### Server (`apps/server`)

```bash
bun run build:bin
bun run build:bin:prod
bun run build:bin:linux-x64
bun run build:bin:darwin-arm64
```

Outputs:

- `apps/server/dist/maxedvault-server`
- `apps/server/dist/maxedvault-server-linux-x64`
- `apps/server/dist/maxedvault-server-darwin-arm64`

### Run compiled binaries

```bash
# server
./apps/server/dist/maxedvault-server --passphrase "your-strong-passphrase"

# client
./apps/client/dist/maxedvault init --server http://localhost:8420
./apps/client/dist/maxedvault status
```

---

## Repository Scripts (Complete)

### Root `package.json`

- `bun run test`
- `bun run check`
- `bun run build:bin:client`
- `bun run build:bin:server`
- `bun run build:bin`
- `bun run build:bin:client:prod`
- `bun run build:bin:server:prod`
- `bun run build:bin:prod`

### Server package scripts (`apps/server/package.json`)

- `bun run dev`
- `bun run start`
- `bun run build:bin`
- `bun run build:bin:prod`
- `bun run build:bin:linux-x64`
- `bun run build:bin:darwin-arm64`
- `bun run test`
- `bun run test:watch`
- `bun run check`

### Client package scripts (`apps/client/package.json`)

- `bun run dev`
- `bun run build:bin`
- `bun run build:bin:prod`
- `bun run build:bin:linux-x64`
- `bun run build:bin:darwin-arm64`
- `bun run test`
- `bun run test:watch`
- `bun run check`

---

## Security Notes

- Do not pass real passphrases/secrets in shell history on shared systems.
- Prefer interactive passphrase entry for server startup where possible.
- Keep `~/.maxedvault/config.json` and DB files protected by OS permissions.
- There is currently no auth layer between client and server; use trusted/local network boundaries.
