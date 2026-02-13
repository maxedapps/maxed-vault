# SQLite ALTER TABLE

## Overview

SQLite supports a limited subset of ALTER TABLE. The ALTER TABLE command in SQLite allows these alterations of an existing table:
- Rename a table
- Rename a column
- Add a column
- Drop a column

## ALTER TABLE RENAME

The `RENAME TO` syntax changes the name of `table-name` to `new-table-name`. This command cannot be used to move a table between attached databases, only to rename a table within the same database. If the table being renamed has triggers or indices, these remain attached to the table after it has been renamed.

### Compatibility Note

- **Versions 3.25.0+ (2018-09-15)**: References to the table within trigger bodies and view definitions are also renamed.
- **Versions 3.26.0+ (2018-12-01)**: FOREIGN KEY constraints are always converted when a table is renamed (unless `PRAGMA legacy_alter_table=ON` is set).

| PRAGMA foreign_keys | PRAGMA legacy_alter_table | Parent Table references updated | SQLite version |
|---|---|---|---|
| Off | Off | No | < 3.26.0 |
| Off | Off | Yes | >= 3.26.0 |
| On | Off | Yes | all |
| Off | On | No | all |
| On | On | Yes | all |

## ALTER TABLE RENAME COLUMN

The `RENAME COLUMN TO` syntax changes the column name. The column name is changed in the table definition and also within all indexes, triggers, and views that reference the column. If the rename would create a semantic ambiguity, the operation fails with an error.

## ALTER TABLE ADD COLUMN

The `ADD COLUMN` syntax adds a new column to an existing table. The new column is always appended to the end. Restrictions include:

- No PRIMARY KEY or UNIQUE constraint
- No default value of `CURRENT_TIME`, `CURRENT_DATE`, `CURRENT_TIMESTAMP`, or expressions in parentheses
- If NOT NULL is specified, a non-NULL default value is required
- If foreign key constraints are enabled, a column with REFERENCES must default to NULL
- Cannot be `GENERATED ALWAYS ... STORED` (VIRTUAL columns allowed)

### Performance Note

ALTER TABLE works by modifying SQL text in the `sqlite_schema` table. Execution time is independent of table size for renames and column additions without constraints. However, adding CHECK constraints or generated columns with NOT NULL requires reading/writing all data.

After ADD COLUMN, the database is unreadable by SQLite 3.1.3 (2005-02-20) and earlier.

## ALTER TABLE DROP COLUMN

The `DROP COLUMN` syntax removes a column from a table. The command rewrites content to purge deleted column data. Restrictions include:

- Column cannot be a PRIMARY KEY or part of one
- Column cannot have a UNIQUE constraint
- Column cannot be indexed
- Column cannot be in a partial index WHERE clause
- Column cannot be in a CHECK constraint
- Column cannot be used in a foreign key constraint
- Column cannot be used in a generated column expression
- Column cannot appear in a trigger or view

### How It Works

SQLite removes the column definition from the CREATE TABLE statement in `sqlite_schema`. The command fails if any schema references prevent parsing after modification.

## Disable Error Checking

ALTER TABLE normally fails if it encounters unparseable entries in `sqlite_schema`. Beginning with SQLite 3.38.0 (2022-02-22), you can disable this check with:

```sql
PRAGMA writable_schema=ON;
```

When enabled, ALTER TABLE silently ignores unparseable rows.

## Making Other Schema Changes

For schema changes not directly supported, use this 12-step procedure:

1. Disable foreign keys: `PRAGMA foreign_keys=OFF`
2. Start a transaction
3. Save indexes, triggers, and views: `SELECT type, sql FROM sqlite_schema WHERE tbl_name='X'`
4. Create new table with desired schema
5. Copy data: `INSERT INTO new_X SELECT ... FROM X`
6. Drop old table: `DROP TABLE X`
7. Rename: `ALTER TABLE new_X RENAME TO X`
8. Recreate indexes, triggers, and views
9. Drop and recreate affected views
10. Verify foreign keys: `PRAGMA foreign_key_check`
11. Commit transaction
12. Re-enable foreign keys if needed

### Correct vs Incorrect Approach

| Correct | Incorrect |
|---|---|
| Create new table | Rename old table |
| Copy data | Create new table |
| Drop old table | Copy data |
| Rename new into old | Drop old table |

**Never rename the old table first** — this breaks links in triggers, views, and foreign key constraints.

### Simpler Procedure for Constraint Changes

For changes that don't affect on-disk content (removing CHECK/FOREIGN KEY/NOT NULL constraints, or changing defaults):

1. Start a transaction
2. Get schema version: `PRAGMA schema_version`
3. Enable editing: `PRAGMA writable_schema=ON`
4. Update definition: `UPDATE sqlite_schema SET sql=... WHERE type='table' AND name='X'`
5. Update dependent objects if needed
6. Increment schema version: `PRAGMA schema_version=X`
7. Disable editing: `PRAGMA writable_schema=OFF`
8. (Optional) Verify: `PRAGMA integrity_check`
9. Commit transaction

## Why ALTER TABLE is Problematic for SQLite

SQLite stores schema as plain text in `sqlite_schema` rather than parsed system tables. This design choice has trade-offs:

**Advantages:**
- Compact schema representation
- Flexible internal implementation
- Backward compatibility with older database files
- Clear, documented database format
- Recommended for long-term data archiving

**Disadvantages:**
- Schema text modification is complex
- ALTER TABLE support lags behind other SQL databases
- Schema changes must handle creative schema designs carefully
