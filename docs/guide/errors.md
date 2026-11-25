# Errors

This page shows how to tell what kind of write failed, whichever driver raised the error.

A failed write surfaces as the driver's own error, with a vendor code in a different place per driver. Three helpers
classify it:

```typescript
import type { DataSource } from 'typeorm';
import { isDatabaseUniqueViolationError } from 'typeorm-extension';

declare const dataSource: DataSource;
declare class User { id: number; name: string; }
declare class ConflictError extends Error {}

try {
    await dataSource.getRepository(User).insert({ name: 'admin' });
} catch (e) {
    if (isDatabaseUniqueViolationError(e)) {
        throw new ConflictError('The name is already taken.');
    }

    throw e;
}
```

- `isDatabaseUniqueViolationError`: a duplicate key, a primary key included.
- `isDatabaseForeignKeyViolationError`: a reference to a missing row, or the delete of a row which is still
  referenced.
- `isDatabaseLockConflictError`: the database gave up on the transaction because of lock contention (a deadlock, a
  serialization failure, a lock wait timeout, a `NOWAIT` read of a locked row).

Each helper takes the `QueryFailedError` typeorm throws or the raw driver error, and never throws itself. The code is
read from the error's `driverError` first, then from the error itself.

`isDatabaseLockConflictError` is unrelated to the `DatabaseLockError` which
[`withDatabaseLock`](./locks#database-lock) throws when its advisory lock can not be acquired.

## Recognized codes

| Driver                | Unique violation                                                  | Foreign key violation                                                                                    | Lock conflict                                                   |
|-----------------------|-------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------|
| postgres              | `23505`                                                           | `23503`                                                                                                  | `40P01`, `40001`, `55P03`                                       |
| cockroachdb           | `23505`                                                           | `23503`                                                                                                  | `40001`, `55P03`                                                |
| mysql, mariadb        | `ER_DUP_ENTRY`                                                    | `ER_NO_REFERENCED_ROW`, `ER_NO_REFERENCED_ROW_2`, `ER_ROW_IS_REFERENCED`, `ER_ROW_IS_REFERENCED_2`         | `ER_LOCK_DEADLOCK`, `ER_LOCK_WAIT_TIMEOUT`, `ER_LOCK_NOWAIT`    |
| mssql (`number`)      | `2627`, `2601`                                                    | `547`, when the message names a `FOREIGN KEY` or `REFERENCE` constraint (547 is shared with `CHECK`)      | `1205`, `1222`                                                  |
| oracle                | `ORA-00001`                                                       | `ORA-02291`, `ORA-02292`                                                                                 | `ORA-00060`, `ORA-08177`, `ORA-00054`                           |
| better-sqlite3        | `SQLITE_CONSTRAINT_UNIQUE`, `SQLITE_CONSTRAINT_PRIMARYKEY`         | `SQLITE_CONSTRAINT_FOREIGNKEY`, and `SQLITE_CONSTRAINT_TRIGGER` with the message `FOREIGN KEY constraint failed` | not covered                                                     |
| mongodb               | `11000`, `11001`                                                  | not covered                                                                                              | not covered                                                     |

oracle is also matched by `errorNum` (`1`, `2291`, `2292`, `60`, `8177`, `54`). For the details of each helper, see
the [API reference](./database-api-reference#isdatabaseuniqueviolationerror).

## Retrying a lock conflict

A lock conflict is usually answered by running the whole transaction again. Retry the transaction, never a single
statement inside it:

```typescript
import type { DataSource } from 'typeorm';
import { isDatabaseLockConflictError, withLockedEntity } from 'typeorm-extension';

declare const dataSource: DataSource;
declare class Order { id: number; status: string; }
declare const id: number;

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fn();
        } catch (e) {
            if (attempt >= attempts || !isDatabaseLockConflictError(e)) {
                throw e;
            }
        }
    }
}

const paid = await withRetry(() => withLockedEntity(dataSource, Order, { id }, async (order, manager) => {
    if (order.status !== 'open') {
        return false;
    }

    order.status = 'paid';
    await manager.save(order);

    return true;
}));
```

- A retry is only sound when the transaction derives its writes from reads made inside it, as the callback above
  does with the locked row.
- A lock wait timeout rolls back just the statement on mysql, mariadb and mssql. Roll the transaction back before
  retrying. typeorm's `transaction()` does that, and so does `withLockedEntity` for the transaction it opens. When
  the rollback itself fails (mssql has already aborted the transaction of a deadlock victim), typeorm still rethrows
  the original error.
- With nested calls, wrap the outermost call: an inner call shares the outer transaction.
- On cockroachdb typeorm's query runner already replays a transaction on a serialization failure, up to
  `maxTransactionRetries` times (default 5). The error only reaches your code once those retries are used up.

## Logging the code

To log which driver error happened, `readDatabaseErrorCode(error)` returns the vendor code as a plain token (`23505`,
`ER_DUP_ENTRY`, `2627`, `ORA-00001`, ...), or `undefined`.

```typescript
import { readDatabaseErrorCode } from 'typeorm-extension';

declare const error: unknown;

console.warn('write failed', { code: readDatabaseErrorCode(error) });
```

- On mssql the server error `number` is read before the generic `code` (`EREQUEST`).
- mysql2 names a mariadb error after MySQL's table. An error only mariadb has comes back as its `errno`.
- A value which is not a short plain token (at most 64 letters, digits, `_` or `-`) is skipped, so a message, which
  may quote stored values, is never returned.

See [readDatabaseErrorCode](./database-api-reference#readdatabaseerrorcode).

## Migration plan errors

The [migration runner](./migrations) refuses an inconsistent state with a `MigrationPlanError` before it runs a
statement. Its `names` property lists the tables or migrations the refusal is about, and the message carries the
`upgradeHint` of the baseline where an upgrade path is the fix.

## Schema snapshot errors

`assertSchemaSnapshotsEqual` throws a `SchemaSnapshotError` when two [schema snapshots](./migrations#proving-a-baseline)
differ. Its `differences` property holds the list `compareSchemaSnapshots` returns (`path`, `kind` and, for a change,
`expected` and `actual`), and the message lists one line per difference. The class is experimental.
