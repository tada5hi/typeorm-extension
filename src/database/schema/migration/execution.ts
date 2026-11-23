import type { DataSource, QueryRunner } from 'typeorm';
import { MigrationExecutor } from 'typeorm';
import { MigrationPlanError } from '../../../errors';
import { withDatabaseLock } from '../../lock';
import { useInitializedDataSource } from '../utils';
import { MIGRATION_LOCK_NAME } from './constants';
import type { MigrationRunOptions } from './types';

/**
 * typeorm keeps createMigrationsTableIfNotExist protected, and no public method
 * creates the table without doing more.
 */
export class RunMigrationExecutor extends MigrationExecutor {
    async createMigrationsTable(queryRunner: QueryRunner): Promise<void> {
        await this.createMigrationsTableIfNotExist(queryRunner);
    }
}

/**
 * Mirrors typeorm's executePendingMigrations: a transaction already open on the
 * query runner is joined, one started here is rolled back on failure.
 */
export async function withTransaction(
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

const INITIALIZE_FLAGS = ['migrationsRun', 'synchronize', 'dropSchema'] as const;

/**
 * Initialize the data source unless initializing it would run typeorm's own
 * migrations or schema sync, which the runner must not be bypassed by.
 *
 * @throws MigrationPlanError
 */
export async function useMigrationDataSource(dataSource: DataSource): Promise<void> {
    if (!dataSource.isInitialized) {
        const options = dataSource.options as Partial<Record<typeof INITIALIZE_FLAGS[number], unknown>>;
        const flags = INITIALIZE_FLAGS.filter((flag) => !!options[flag]);

        if (flags.length > 0) {
            throw MigrationPlanError.dataSourceInitializeRuns(flags);
        }
    }

    await useInitializedDataSource(dataSource);
}

/**
 * Runs fn on the given query runner, or on one created here which is locked
 * (unless lock is false) and released afterwards. A given query runner gets no
 * lock and is never released.
 */
export async function withMigrationRunner<T>(
    dataSource: DataSource,
    options: Pick<MigrationRunOptions, 'queryRunner' | 'lock'>,
    fn: (queryRunner: QueryRunner) => Promise<T>,
): Promise<T> {
    await useMigrationDataSource(dataSource);

    if (options.queryRunner) {
        return fn(options.queryRunner);
    }

    const queryRunner = dataSource.createQueryRunner();

    try {
        const run = () => fn(queryRunner);

        if (options.lock === false) {
            return await run();
        }

        return await withDatabaseLock(queryRunner, options.lock ?? MIGRATION_LOCK_NAME, run, { strict: false });
    } finally {
        await queryRunner.release();
    }
}
