import type { DataSource, Migration, QueryRunner } from 'typeorm';
import { MigrationExecutor } from 'typeorm';
import { MigrationPlanError } from '../../../errors';
import { useInitializedDataSource } from '../utils';
import { scanMigrationSource } from './source';
import { listUserTableNames } from './tables';
import type { MigrationPlan, MigrationPlanOptions } from './types';

async function readUserTables(
    dataSource: DataSource,
    queryRunner: QueryRunner,
    ignoreTables: string[],
): Promise<string[]> {
    const { options } = dataSource;

    const skip = new Set<string>([
        ...ignoreTables,
        options.migrationsTableName ?? 'migrations',
        (options as { metadataTableName?: string }).metadataTableName ?? 'typeorm_metadata',
    ]);

    const names = await listUserTableNames(queryRunner);

    return names.filter((name) => !skip.has(name));
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
        // A missing migrations table reads as no rows (mongodb skips the check), nothing is created.
        const executed = await new MigrationExecutor(dataSource, queryRunner).getExecutedMigrations();
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
            const tables = await readUserTables(dataSource, queryRunner, options.ignoreTables ?? []);

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
