import type { DataSource, Migration, QueryRunner } from 'typeorm';
import { ForbiddenTransactionModeOverrideError, InstanceChecker } from 'typeorm';
import { RunMigrationExecutor, withMigrationRunner, withTransaction } from './execution';
import { isMigrationPlanEmpty, planDatabaseMigrations } from './plan';
import type { MigrationRunOptions } from './types';

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

    const executor = new RunMigrationExecutor(dataSource, queryRunner);

    // Like executePendingMigrations: both tables exist before any transaction starts.
    await executor.createMigrationsTable(queryRunner);

    const schemaBuilder = dataSource.driver.createSchemaBuilder();

    if (InstanceChecker.isRdbmsSchemaBuilder(schemaBuilder)) {
        await schemaBuilder.createMetadataTableIfNecessary(queryRunner);
    }

    const marker = plan.adopt ? plan.source.baseline : undefined;
    const executed: Migration[] = [];

    // beforeMigration / afterMigration run only around a transaction started here, as in typeorm.
    const run = async (migration: Migration) => {
        await migration.instance?.up(queryRunner);
        await executor.insertMigration(migration);

        executed.push(migration);
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
    return withMigrationRunner(dataSource, options, (queryRunner) => execute(dataSource, queryRunner, options));
}
