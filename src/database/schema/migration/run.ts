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
    const { logger } = dataSource;

    // The messages mirror typeorm's executePendingMigrations.
    if (isMigrationPlanEmpty(plan)) {
        logger.logSchemaBuild('No migrations are pending');

        return [];
    }

    const last = plan.executed.reduce<Migration | undefined>(
        (latest, row) => (!latest || row.timestamp > latest.timestamp ? row : latest),
        undefined,
    );

    logger.logSchemaBuild(`${plan.executed.length} migrations are already loaded in the database.`);
    logger.logSchemaBuild(`${plan.source.current.length} migrations were found in the source code.`);

    if (last) {
        logger.logSchemaBuild(`${last.name} is the last executed migration. It was executed on ${new Date(last.timestamp).toString()}.`);
    }

    logger.logSchemaBuild(`${plan.legacy.length + plan.pending.length} migrations are new migrations must be executed.`);

    const mode = options.transaction ?? dataSource.options.migrationsTransactionMode ?? 'all';

    if (mode === 'all') {
        const overriding = [...plan.legacy, ...plan.pending]
            .filter((migration) => migration.instance?.transaction !== undefined);

        if (overriding.length > 0) {
            const error = new ForbiddenTransactionModeOverrideError(overriding);

            logger.logMigration(`Migrations failed, error: ${error.message}`);

            throw error;
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
        try {
            await migration.instance?.up(queryRunner);
            await executor.insertMigration(migration);
        } catch (e) {
            logger.logMigration(`Migration "${migration.name}" failed, error: ${(e as Error | undefined)?.message}`);

            throw e;
        }

        executed.push(migration);

        logger.logSchemaBuild(`Migration ${migration.name} has been executed successfully.`);
    };

    const adopt = async (baseline: Migration) => {
        await executor.insertMigration(baseline);

        logger.logSchemaBuild(`Baseline ${baseline.name} has been recorded as executed, adopting the legacy migrations.`);
    };

    if (mode === 'all') {
        if (plan.legacy.length > 0 || marker) {
            await withTransaction(queryRunner, true, async () => {
                for (const migration of plan.legacy) {
                    await run(migration);
                }

                if (marker) {
                    await adopt(marker);
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
        await withTransaction(queryRunner, fallback, () => adopt(marker));
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
