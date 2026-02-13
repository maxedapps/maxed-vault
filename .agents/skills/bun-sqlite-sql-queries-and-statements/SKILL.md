---
name: bun-sqlite-sql-queries-and-statements
description: Writes SQL queries and commands (including schema definitions) using modern (Bun) SQLite features and concepts, following common best practices.
---

# Writing Bun SQLite Statements & Commands

## Instructions

When writing SQL queries and schema definitions for Bun SQLite:

1. **Use parameterized queries** to prevent SQL injection and improve performance:
   ```javascript
   const query = db.query("SELECT * FROM users WHERE id = $id");
   query.get({ $id: 123 });
   ```

2. **Use explicit parameter prefixes** (`$`, `:`, or `@`) in query strings. Enable `strict: true` on the database connection to catch missing parameters.

3. **Leverage transactions** for multiple related operations to ensure data consistency:
   ```javascript
   const insert = db.transaction((user) => {
     db.query("INSERT INTO users (name, email) VALUES (?, ?)").run(user.name, user.email);
     db.query("INSERT INTO audit_log (action) VALUES (?)").run("user_created");
   });
   insert(newUser);
   ```

4. **Use prepared statements** for repeated queries to avoid re-parsing:
   ```javascript
   const stmt = db.prepare("SELECT * FROM products WHERE category = ?");
   stmt.all("electronics");
   stmt.all("books");
   ```

5. **Design indexes strategically** on frequently queried columns and WHERE clause predicates. Remember: indexes speed up reads but slow writes.

6. **Use PRAGMA statements** for optimization:
   - `PRAGMA journal_mode = WAL;` - Better concurrency for multi-user scenarios
   - `PRAGMA synchronous = NORMAL;` - Faster writes with acceptable durability
   - `PRAGMA foreign_keys = ON;` - Enable referential integrity

7. **Batch insert operations** for better performance:
   ```javascript
   const insert = db.transaction((rows) => {
     const stmt = db.prepare("INSERT INTO items (name, value) VALUES (?, ?)");
     for (const row of rows) stmt.run(row.name, row.value);
   });
   ```

8. **Normalize your schema** to avoid redundancy, but denormalize strategically where reads dominate and performance matters.

## Best Practices

- Keep queries readable and maintainable—explicit is better than clever
- Use type-safe approaches when possible (Bun's runtime can infer types)
- Test queries with realistic data volumes to identify index needs
- Use `EXPLAIN QUERY PLAN` to verify indexes are being used effectively
- Avoid `SELECT *`—specify only needed columns
- Use `LIMIT` and `OFFSET` for pagination, not for optimization
- Keep transactions small and short to minimize lock contention

## Additional Resources

For detailed Bun SQLite API reference, see [bun-sqlite.md](references/bun-sqlite.md).

For schema migration patterns and ALTER TABLE guidance, see [sqlite-alter-table.md](references/sqlite-alter-table.md).