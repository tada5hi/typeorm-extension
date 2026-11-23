import type { DataSource, Migration, QueryRunner } from 'typeorm';
import { ForbiddenTransactionModeOverrideError, MigrationExecutor } from 'typeorm';
import { withDatabaseLock } from '../../lock';
import { useInitializedDataSource } from '../utils';
import { MIGRATION_LOCK_NAME } from './constants';
import { isMigrationPlanEmpty, planDatabaseMigrations } from './plan';
import type { MigrationRunOptions } from './types';

/**
 * Mirrors typeorm's executePendingMigrations: a transaction already open on the
 * query runner is joined, one started here is rolled back on failure.
 */
async function withTransaction(
    queryRunner: QueryRunner,
    enabled: boolean,
    fn: () => Promise<void>,
): Promise<void> {
    if (!enabled || queryRunner.isTransactionActive) {
        await fn();

        return;
    }

    await queryRunner.beforeMigration();
    await queryRunner.startTransaction();

    try {
        await fn();
        await queryRunner.commitTransaction();
    } catch (e) {
        try {
            await queryRunner.rollbackTransaction();
        } catch {
            // the original error matters more
        }

        throw e;
    }

    await queryRunner.afterMigration();
}

async function execute(
    dataSource: DataSource,
    queryRunner: QueryRunner,
    options: MigrationRunOptions,
): Promise<Migration[]> {
    const plan = await planDatabaseMigrations(dataSource, { ...options, queryRunner });

    if (isMigrationPlanEmpty(plan)) {
        return [];
    }

    const mode = options.transaction ?? dataSource.options.migrationsTransactionMode ?? 'all';

    if (mode === 'all') {
        const overriding = [...plan.legacy, ...plan.pending]
            .filter((migration) => migration.instance?.transaction !== undefined);

        if (overriding.length > 0) {
            throw new ForbiddenTransactionModeOverrideError(overriding);
        }
    }

    const executor = new MigrationExecutor(dataSource, queryRunner);
    const marker = plan.adopt ? plan.source.baseline : undefined;
    const executed: Migration[] = [];

    const run = async (migration: Migration) => {
        executed.push(await executor.executeMigration(migration));
    };

    if (mode === 'all') {
        if (plan.legacy.length > 0 || marker) {
            await withTransaction(queryRunner, true, async () => {
                for (const migration of plan.legacy) {
                    await run(migration);
                }

                if (marker) {
                    await executor.insertMigration(marker);
                }
            });
        }

        if (plan.pending.length > 0) {
            await withTransaction(queryRunner, true, async () => {
                for (const migration of plan.pending) {
                    await run(migration);
                }
            });
        }

        return executed;
    }

    const fallback = mode === 'each';

    for (const migration of plan.legacy) {
        await withTransaction(queryRunner, migration.instance?.transaction ?? fallback, () => run(migration));
    }

    if (marker) {
        await withTransaction(queryRunner, fallback, () => executor.insertMigration(marker));
    }

    for (const migration of plan.pending) {
        await withTransaction(queryRunner, migration.instance?.transaction ?? fallback, () => run(migration));
    }

    return executed;
}

/**
 * Plan the migrations against the database state and run them: the legacy chain
 * of a baseline the database is adopting, the baseline marker, then the pending
 * migrations. Planning and running share one query runner and, unless a query
 * runner is given, one database lock.
 *
 * @returns the executed legacy and pending migrations, in order (the marker is not listed).
 */
export async function runDatabaseMigrations(
    dataSource: DataSource,
    options: MigrationRunOptions = {},
): Promise<Migration[]> {
    await useInitializedDataSource(dataSource);

    if (options.queryRunner) {
        return execute(dataSource, options.queryRunner, options);
    }

    const queryRunner = dataSource.createQueryRunner();

    try {
        const run = () => execute(dataSource, queryRunner, options);

        if (options.lock === false) {
            return await run();
        }

        return await withDatabaseLock(queryRunner, options.lock ?? MIGRATION_LOCK_NAME, run, { strict: false });
    } finally {
        await queryRunner.release();
    }
}
