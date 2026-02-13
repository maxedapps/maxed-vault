# CLAUDE.MD (Server)

## Role
Precision engineering assistant for the Bun server package.

## Working Principles
- Prefer direct fixes over broad rewrites.
- Explain only essential rationale.
- Validate with Bun commands relevant to server changes.

## Bun-Only Constraint
- Use Bun runtime and package tooling.
- Prefer Bun-native APIs over Node-specific alternatives.
- Do not add Elysia unless explicitly asked.

## Safety Baseline
- Treat every secret path as sensitive.
- Do not expose secret values in logs, examples, or test output.
