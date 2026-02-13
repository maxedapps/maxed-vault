---
name: tanstack-start-router-head-metadata
description: Write and configure route metadata in-line with official best practices for TanStack Start / Router. Use when managing SEO, document head, title/meta tags, or scripts in TanStack Router applications.
---

# TanStack Start/Router Head Metadata

## Instructions

When configuring the document head in TanStack Router:

1. **Always ensure required components** are rendered in the root route:
   ```tsx
   export const Route = createRootRoute({
     component: () => (
       <html>
         <head>
           <HeadContent />
         </head>
         <body>
           <Outlet />
           <Scripts />
         </body>
       </html>
     ),
   })
   ```

2. **Use the `head` property** on routes to define metadata:
   ```tsx
   export const Route = createFileRoute('/about')({
     head: () => ({
       meta: [
         { title: 'About Us' },
         { name: 'description', content: 'Learn about our company' },
         { property: 'og:title', content: 'About Us' },
       ],
       links: [
         { rel: 'canonical', href: 'https://example.com/about' },
       ],
     }),
   })
   ```

3. **Understand tag deduplication**: Nested routes override parent tags:
   - `title` from child routes replaces parent title
   - `meta` tags with same `name` or `property` are deduplicated (last wins)
   - `links` and `scripts` are not automatically deduplicated

4. **Use `ScriptOnce` for pre-hydration scripts** to prevent FOUC or theme flicker:
   ```tsx
   <ScriptOnce children={`
     const theme = localStorage.getItem('theme') || 'auto';
     document.documentElement.classList.add(theme);
   `} />
   ```
   Add `suppressHydrationWarning` on elements modified before hydration.

5. **Load external scripts** via the `scripts` property:
   ```tsx
   head: () => ({
     scripts: [
       { src: 'https://analytics.example.com/script.js' },
     ],
   })
   ```

## Best Practices

- Keep metadata close to the route—define `head` where the route is created
- Use descriptive, unique titles for each route (improves SEO)
- Include Open Graph tags for social media sharing
- Avoid inline scripts unless necessary for pre-hydration (prefer external files)
- Use `ScriptOnce` only for critical path scripts that must run before React
- Test with JavaScript disabled to verify SSR rendering

## Additional Resources

For complete documentation on head management, deduplication rules, and `ScriptOnce` usage patterns, see [seo-document-head-management.md](references/seo-document-head-management.md).

