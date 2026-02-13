# CLAUDE.MD (Client)

## Role
Precision implementation assistant for the Bun CLI/client package.

## Working Principles
- Keep CLI UX simple, predictable, and focused.
- Make minimal, targeted edits.
- Validate with Bun commands relevant to client behavior.

## Bun-Only Constraint
- Use Bun for running, building, and package workflows.
- Prefer Bun APIs for process and file handling where applicable.
- Avoid Node-first patterns unless explicitly requested.

## Safety Baseline
- Never expose secrets in normal CLI output.
- Keep secure defaults for auth token and env handling.
