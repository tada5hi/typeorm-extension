# Locks

This page covers two locks: a named advisory lock that lets one process at a time run a piece of work, and a row
lock for a read-modify-write on a single entity.

## Database Lock

`withDatabaseLock` runs a callback while holding a named advisory lock, so only one session at a time runs it, across
processes. A typical case is running the migrations on startup across several replicas:

```typescript
import type { DataSource } from 'typeorm';
import { withDatabaseLock } from 'typeorm-extension';

declare const dataSource: DataSource;

const queryRunner = dataSource.createQueryRunner();
try {
    await withDatabaseLock(queryRunner, 'migrations', () => dataSource.runMigrations());
} finally {
    await queryRunner.release();
}
```

- Keep `migrationsRun` off in the data source options. `initialize()` would run the migrations before the lock is
  taken. Run them inside the callback instead.
- The lock belongs to the connection of the query runner, so keep the same query runner for the whole call and
  release it afterwards. The callback's own queries (like `runMigrations()`) use another connection, so the pool
  needs at least two.
- By default the call waits until the lock is free. Pass `{ timeout }` in milliseconds to throw a
  `DatabaseLockError` instead; `0` tries once.
- The lock is released afterwards, also when the callback throws. The callback's error is then rethrown.
- Nested calls with the same name on the same query runner do not block each other.
- The lock is scoped to the database, so other databases on the same server use their own.

### Transactions

A lock outlives a rollback, so the call is refused with a `DatabaseLockError` on a query runner which is already in a
transaction. If the callback leaves a transaction open on that query runner, the helper rolls it back before the
release. A callback which returned normally then throws a `DatabaseLockError`, since committing after the release
would defeat the lock.

### Failed release

If the release statement fails, the session is ended instead of going back to the pool still holding the lock. The
query runner then counts as released and can not be used any further. Ending the session also frees the locks of
enclosing calls on the same query runner.

- A callback which returned normally then throws a `DatabaseLockError` with the release error as `cause`.
- The error of a callback which threw is rethrown unchanged.

### Drivers

Only `postgres`, `mysql` and `mariadb` are supported. Every other driver throws a `DriverError`: cockroachdb accepts
the postgres advisory lock functions, but they do not lock anything. Pass `{ strict: false }` to run the callback
without a lock there instead, for example in a test suite on sqlite. Only do that where a second process can not
exist.

For the options, see [withDatabaseLock](./database-api-reference#withdatabaselock) and
[DatabaseLockOptions](./database-api-reference#databaselockoptions). The recipe
[Deploying with several replicas](./recipes/deploy) shows the lock in a full startup sequence.

## Locked Entity

`withLockedEntity` is a read-modify-write on one row. It reads the row with a write lock (`FOR UPDATE`, an `UPDLOCK`
hint on mssql) inside a transaction and hands it to the callback. A second caller for the same row waits until the
first transaction ends, and then reads the row as the first one left it. A typical case is a status transition which
only one of several concurrent requests may make:

```typescript
import type { DataSource } from 'typeorm';
import { withLockedEntity } from 'typeorm-extension';

declare const dataSource: DataSource;
declare class Post { id: number; status: string; }
declare const id: number;

const published = await withLockedEntity(dataSource, Post, { id }, async (post, manager) => {
    if (post.status !== 'draft') {
        return false;
    }

    post.status = 'published';
    await manager.save(post);

    return true;
});
```

- The helper does not save anything. The callback checks and writes through the manager it is handed, so entity
  subscribers fire as usual.
- It resolves what the callback returns, or `null` without calling it when no row matches.
- A throw rolls back the transaction the helper opened.
- An `EntityManager` which is already in a transaction is reused, and no transaction of its own is opened. That is how
  calls nest: inside the callback, `withLockedEntity(manager, Child, ...)` locks a second row in the same transaction.
- `{ onLocked: 'nowait' }` fails at once instead of waiting for a locked row. The error is the driver's own, and
  `isDatabaseLockConflictError` recognizes it. typeorm ignores that option on mssql, so it throws a `DriverError`
  there.

### What is locked

Only the row itself. Relations of the entity, eager ones included, are loaded in separate queries without a lock.
For the same reason `where` must not look the row up through a relation with a nested object (`{ owner: { id } }`),
which would join and lock the related row too: that throws an `OptionsError`. Use a find operator on the relation
instead (`{ owner: Equal(id) }`), which compares the join column.

### Rules

- Change the entity you were handed. Saving a copy read before the call writes stale values over the locked row.
- Inside the callback, pass the manager you were handed, not the data source. A call on the data source opens a
  second transaction on another connection, and waits forever for a row the first one holds.
- When nesting, lock rows in the same order everywhere. The server detects a deadlock, and
  `isDatabaseLockConflictError` recognizes the error, so the whole call can be retried (see [Errors](./errors#retrying-a-lock-conflict)).
- Do slow work (sending a message, an HTTP call) after the call returns, not inside the callback: the row stays
  locked until the transaction ends.
- The options of a nested call apply only to the row it locks, but its failure is the transaction's. On postgres and
  cockroachdb a failed statement (a `nowait` miss included) aborts the whole transaction, so catching the error inside
  the callback does not let it carry on there.
- The second caller reading the row as the first left it assumes the default `READ COMMITTED`. In a transaction with
  a stricter isolation level postgres raises a serialization failure instead, which `isDatabaseLockConflictError`
  recognizes as well.

### Drivers

Supported are `postgres`, `cockroachdb`, `mysql`, `mariadb`, `oracle` and `mssql`. Every other driver throws a
`DriverError` before a transaction is opened. Pass `{ strict: false }` to run the callback without a lock there
instead, for example in a test suite on sqlite (still within a transaction). On mongodb typeorm has no transactions,
so a throw does not roll anything back there.

### Row lock in your own query

For a locked read of your own, `isRowLockSupported(source)` tells whether the driver gets a row lock. It takes a data
source, an entity manager or a driver type and never throws, so you can leave the `lock` find option out where
typeorm would throw `LockNotSupportedOnGivenDriverError` (for example on better-sqlite3):

```typescript
import type { EntityManager } from 'typeorm';
import { isRowLockSupported } from 'typeorm-extension';

declare const manager: EntityManager;
declare class Post { id: number; status: string; }
declare const id: number;

const post = await manager.findOne(Post, {
    where: { id },
    ...(isRowLockSupported(manager) ? { lock: { mode: 'pessimistic_write' } } : {}),
});
```

For the options, see [withLockedEntity](./database-api-reference#withlockedentity),
[EntityLockOptions](./database-api-reference#entitylockoptions) and
[isRowLockSupported](./database-api-reference#isrowlocksupported).

## Driver support

| Helper             | Drivers                                                                                                               |
|--------------------|-----------------------------------------------------------------------------------------------------------------------|
| `withDatabaseLock` | `postgres`, `mysql`, `mariadb` (otherwise throws, or runs unlocked if not `strict`)                                   |
| `withLockedEntity` | `postgres`, `cockroachdb`, `mysql`, `mariadb`, `oracle`, `mssql` (otherwise throws, or runs unlocked if not `strict`) |
