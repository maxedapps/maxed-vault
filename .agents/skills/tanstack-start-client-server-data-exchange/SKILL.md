---
name: tanstack-start-client-server-data-exchange
description: Generate correct, best-practice conforming code for fetching data or mutating data in TanStack Start applications. Also ensure spilling server-side code to the client-side by following best practices regarding the definition of server-side functions.
---

# TanStack Start Client-Server Data Exchange

## Core Principles

1. **All code is isomorphic by default** - Code runs in both server and client bundles unless explicitly constrained
2. **Route loaders are isomorphic** - They run on server during SSR AND on client during navigation
3. **Use server functions for server-only operations** - Never assume loaders are server-only
4. **⚠️ MANDATORY: Wrap ALL server-only functions with `createServerOnlyFn()`** - This prevents accidental client bundle inclusion and runtime errors

## Instructions

### Creating Server Functions

Use `createServerFn()` for server-only logic callable from client code:

```tsx
import { createServerFn } from '@tanstack/react-start'

// GET request (default)
export const getData = createServerFn().handler(async () => {
  // Server-only: database, env vars, file system
  return await db.posts.findMany()
})

// POST request with validation
export const saveData = createServerFn({ method: 'POST' })
  .inputValidator((data: { title: string }) => data)
  .handler(async ({ data }) => {
    return await db.posts.create(data)
  })
```

### Calling Server Functions

Server functions can be called from:

```tsx
// Route loaders
export const Route = createFileRoute('/posts')({
  loader: () => getPosts(),
})

// Components (with useServerFn hook)
function PostList() {
  const getPosts = useServerFn(getServerPosts)
  const { data } = useQuery({
    queryKey: ['posts'],
    queryFn: () => getPosts(),
  })
}

// Other server functions
const getPostWithAuthor = createServerFn().handler(async () => {
  const post = await getPost()
  const author = await getAuthor({ id: post.authorId })
  return { post, author }
})
```

### File Organization Pattern

Separate server-only code from server functions:

```
src/utils/
├── users.functions.ts   # createServerFn wrappers (safe to import anywhere)
├── users.server.ts      # Server-only helpers (ALL wrapped with createServerOnlyFn)
└── schemas.ts           # Shared types/validation (client-safe)
```

```tsx
// users.server.ts - ALL server-only functions MUST be wrapped
import { createServerOnlyFn } from '@tanstack/react-start'

// ✅ CORRECT - Wrapped with createServerOnlyFn
export const findUserById = createServerOnlyFn(async (id: string) => {
  return db.query.users.findFirst({ where: eq(users.id, id) })
})

export const getDbConnection = createServerOnlyFn(() => {
  return process.env.DATABASE_URL
})

// ❌ WRONG - Unwrapped, will leak to client
export async function findUserById(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}

// users.functions.ts - Safe to import in client components
import { createServerFn } from '@tanstack/react-start'
import { findUserById } from './users.server'

export const getUser = createServerFn({ method: 'GET' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => findUserById(data.id))
```

### Environment-Specific Execution

**⚠️ ALWAYS wrap server-only functions with `createServerOnlyFn()`:**

```tsx
import {
  createServerOnlyFn,
  createClientOnlyFn,
  createIsomorphicFn,
} from '@tanstack/react-start'

// ✅ MANDATORY - All server-only code must be wrapped
const getSecret = createServerOnlyFn(() => process.env.API_SECRET)
const queryDatabase = createServerOnlyFn(async (sql: string) => {
  return await db.query(sql)
})
const readEnvConfig = createServerOnlyFn(() => ({
  apiKey: process.env.API_KEY,
  dbUrl: process.env.DATABASE_URL,
}))

// Client-only utility (throws error on server)
const saveToStorage = createClientOnlyFn((data: any) => {
  localStorage.setItem('data', JSON.stringify(data))
})

// Different implementations per environment
const logger = createIsomorphicFn()
  .server((msg) => console.log(`[SERVER]: ${msg}`))
  .client((msg) => console.log(`[CLIENT]: ${msg}`))
```

**Why this is mandatory:**
- Unwrapped functions end up in the client bundle
- Secrets and server logic get exposed to browsers
- Runtime errors occur when server APIs (db, fs) aren't available
- `createServerOnlyFn()` makes the build fail if accidentally used client-side

### Handling Client-Only Components

```tsx
import { ClientOnly } from '@tanstack/react-router'

function Analytics() {
  return (
    <ClientOnly fallback={null}>
      {/* Only renders after hydration */}
      <GoogleAnalyticsScript />
    </ClientOnly>
  )
}
```

## Common Pitfalls to Avoid

❌ **Never expose secrets in route loaders**:
```tsx
// WRONG - Loader is isomorphic, exposes secret to client
export const Route = createFileRoute('/api')({
  loader: () => {
    const secret = process.env.SECRET // Leaked to client bundle!
    return fetch(`/api?key=${secret}`)
  },
})
```

✅ **Use server functions for server-only operations**:
```tsx
// CORRECT - Server function keeps secret on server
const fetchSecurely = createServerFn().handler(() => {
  const secret = process.env.SECRET // Server-only
  return fetch(`/api?key=${secret}`)
})

export const Route = createFileRoute('/api')({
  loader: () => fetchSecurely(), // Safe isomorphic call
})
```

❌ **Don't use dynamic imports for server functions**:
```tsx
// WRONG - Can cause bundler issues
const { getUser } = await import('~/utils/users.functions')
```

✅ **Use static imports**:
```tsx
// CORRECT - Build process handles tree-shaking
import { getUser } from '~/utils/users.functions'
```

## Best Practices

- **⚠️ MANDATORY: Wrap ALL server-only functions with `createServerOnlyFn()`** - No exceptions. Every function that accesses env vars, databases, file system, or contains server-only logic MUST be wrapped
- Always validate server function inputs (network boundary = untrusted data)
- Use `.server.ts` suffix for files with server-only code where ALL exports are wrapped with `createServerOnlyFn()`
- Keep server function implementations separate from their definitions
- Remember: loaders are **isomorphic**, not server-only
- Provide meaningful fallbacks for `<ClientOnly>` components
- Test with both SSR and client-side navigation to verify execution
- Review client bundle to verify no server-only code leaked (use bundle analyzer)

## Additional Resources

- [server-functions.md](references/server-functions.md) - Complete server function API, validation patterns, and file organization strategies
- [execution-model.md](references/execution-model.md) - Deep dive into isomorphic execution, runtime environments, and architectural patterns
- [environment-functions.md](references/environment-functions.md) - Detailed API reference for `createIsomorphicFn`, `createServerOnlyFn`, and `createClientOnlyFn`
- [code-execution-patterns.md](references/code-execution-patterns.md) - Real-world patterns, common problems, and production checklist
