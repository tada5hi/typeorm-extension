import type {
    DataSource,
    EntityManager,
    EntityTarget,
    FindOptionsWhere,
    ObjectLiteral,
} from 'typeorm';
import { InstanceChecker } from 'typeorm';
import { DriverError, OptionsError } from '../../errors';
import { isObject } from '../../utils';
import type { EntityLockOptions } from './type';

/**
 * Drivers for which typeorm emits a row lock (FOR UPDATE, on mssql an UPDLOCK
 * hint). typeorm ignores `onLocked` on mssql, so that is refused there.
 */
const DRIVERS = ['postgres', 'cockroachdb', 'mysql', 'mariadb', 'oracle', 'mssql'];

/**
 * Read one row with a write lock, inside a transaction, and hand it to the
 * callback, which checks and writes through the given manager. Concurrent
 * callers for the same row wait until the transaction ends, unless `onLocked`
 * is nowait, which rejects with the driver's error (see
 * isDatabaseLockConflictError). The helper does not save: it resolves what
 * the callback returns, or null (without calling it) when no row matches.
 * A throw rolls the transaction back.
 *
 * An entity manager already in a transaction is reused, so nested calls lock
 * within the outer transaction.
 *
 * Supported for postgres, cockroachdb, mysql, mariadb, oracle and mssql.
 *
 * @throws DriverError on any other driver, unless `strict` is false,
 * and for `onLocked` on mssql.
 * @throws OptionsError if `where` filters through a relation (a nested
 * object), since the join would lock the related rows too.
 */
export async function withLockedEntity<T extends ObjectLiteral, R>(
    source: DataSource | EntityManager,
    target: EntityTarget<T>,
    where: FindOptionsWhere<T>,
    fn: (entity: T, manager: EntityManager) => R | Promise<R>,
    options: EntityLockOptions = {},
) : Promise<Awaited<R> | null> {
    const manager = InstanceChecker.isDataSource(source) ? source.manager : source;
    const { type } = manager.dataSource.options;
    const locked = DRIVERS.includes(type);
    if (!locked && options.strict !== false) {
        throw DriverError.lockNotSupported(type);
    }

    if (options.onLocked && type === 'mssql') {
        throw DriverError.lockNowaitNotSupported(type);
    }

    // A nested object on a relation is a join, and the lock would cover the
    // joined rows as well (or the server refuses it). A find operator on a
    // relation compares the join column and needs no join.
    const metadata = manager.dataSource.getMetadata(target);
    const relation = Object.keys(where).find((key) => {
        const value = where[key];

        return !!metadata.findRelationWithPropertyPath(key) &&
            (isObject(value) || Array.isArray(value)) &&
            !InstanceChecker.isFindOperator(value);
    });
    if (relation) {
        throw OptionsError.lockWhereRelation(relation);
    }

    const run = async (transaction: EntityManager) : Promise<Awaited<R> | null> => {
        const entity = await transaction.findOne(target, {
            where,
            // relations in separate queries: a join would lock the related
            // rows too, and postgres refuses FOR UPDATE on the nullable side
            // of an outer join.
            relationLoadStrategy: 'query',
            ...(locked ? { lock: { mode: 'pessimistic_write', onLocked: options.onLocked } } : {}),
        });
        if (!entity) {
            return null;
        }

        return await fn(entity, transaction);
    };

    if (manager.queryRunner?.isTransactionActive) {
        return run(manager);
    }

    // ponytail: typeorm's mongodb transaction() is a no-op, so not strict
    // means no lock and no rollback there.
    return manager.transaction(run);
}
