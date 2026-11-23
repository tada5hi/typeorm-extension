import type { DataSource, Migration, QueryRunner } from 'typeorm';
import { MigrationExecutor } from 'typeorm';
import { MigrationPlanError } from '../../../errors';
import { useInitializedDataSource } from '../utils';
import { scanMigrationSource } from './source';
import type { MigrationPlan, MigrationPlanOptions } from './types';

async function readExecuted(
    dataSource: DataSource,
    queryRunner: QueryRunner,
    tableName: string,
): Promise<Migration[]> {
    // getExecutedMigrations() creates the table, so only ask when it exists.
    if (!await queryRunner.hasTable(tableName)) {
        return [];
    }

    return new MigrationExecutor(dataSource, queryRunner).getExecutedMigrations();
}

async function readUserTables(
    dataSource: DataSource,
    queryRunner: QueryRunner,
    migrationsTable: string,
    ignoreTables: string[],
): Promise<string[]> {
    const { driver, options } = dataSource;
    const { schema } = (driver.options as { schema?: string });

    const metadataName = (options as { metadataTableName?: string }).metadataTableName ?? 'typeorm_metadata';
    const skip = new Set<string>(ignoreTables);

    for (const name of [migrationsTable, metadataName]) {
        skip.add(name);
        skip.add(driver.buildTableName(name, schema, driver.database));
    }

    const tables = await queryRunner.getTables();

    return tables
        .map((table) => table.name)
        .filter((name) => !skip.has(name));
}

/**
 * Read the database state and decide what a run has to do. Nothing is written and
 * the migrations table is not created.
 */
export async function planDatabaseMigrations(
    dataSource: DataSource,
    options: MigrationPlanOptions = {},
): Promise<MigrationPlan> {
    await useInitializedDataSource(dataSource);

    const source = await scanMigrationSource(dataSource, options);

    const queryRunner = options.queryRunner ?? dataSource.createQueryRunner();

    try {
        const { driver } = dataSource;
        const migrationsTable = driver.buildTableName(
            dataSource.options.migrationsTableName ?? 'migrations',
            (driver.options as { schema?: string }).schema,
            driver.database,
        );

        const executed = await readExecuted(dataSource, queryRunner, migrationsTable);
        const executedNames = new Set(executed.map((row) => row.name));
        const withoutRow = (items: Migration[]) => items.filter((item) => !executedNames.has(item.name));

        const { baseline } = source;

        if (!baseline) {
            return {
                source, 
                executed, 
                legacy: [], 
                adopt: false, 
                pending: withoutRow(source.current), 
            };
        }

        if (executed.length === 0) {
            const tables = await readUserTables(dataSource, queryRunner, migrationsTable, options.ignoreTables ?? []);

            if (tables.length > 0) {
                throw MigrationPlanError.populatedSchemaWithoutHistory(tables, source.upgradeHint);
            }

            return {
                source, 
                executed, 
                legacy: [], 
                adopt: false, 
                pending: [...source.current], 
            };
        }

        if (executedNames.has(baseline.name)) {
            return {
                source, 
                executed, 
                legacy: [], 
                adopt: false, 
                pending: withoutRow(source.current), 
            };
        }

        if (!source.legacy) {
            throw MigrationPlanError.legacyMissing(baseline.name, source.upgradeHint);
        }

        const { legacy } = source;
        const legacyNames = new Set(legacy.map((item) => item.name));
        const unknown = executed.filter((row) => !legacyNames.has(row.name));

        if (unknown.length > 0) {
            throw MigrationPlanError.unknownExecuted(unknown.map((row) => row.name), source.upgradeHint);
        }

        return {
            source,
            executed,
            legacy: withoutRow(legacy),
            adopt: true,
            pending: withoutRow(source.current).filter((item) => item.timestamp > baseline.timestamp),
        };
    } finally {
        if (!options.queryRunner) {
            await queryRunner.release();
        }
    }
}

export function isMigrationPlanEmpty(plan: MigrationPlan): boolean {
    return plan.legacy.length === 0 && !plan.adopt && plan.pending.length === 0;
}
