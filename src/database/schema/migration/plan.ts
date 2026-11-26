import type { DataSource, Migration, QueryRunner } from 'typeorm';
import { MigrationExecutor } from 'typeorm';
import { MigrationPlanError } from '../../../errors';
import { isMigrationBaselineClass } from './baseline';
import { useMigrationDataSource } from './execution';
import { scanMigrationSource } from './source';
import { readUserTableNames } from './tables';
import type { MigrationPlan, MigrationPlanOptions } from './types';

/**
 * Read the database state and decide what a run has to do. Nothing is written and
 * the migrations table is not created.
 *
 * @experimental The migration runner API may change in a minor release.
 */
export async function planDatabaseMigrations(
    dataSource: DataSource,
    options: MigrationPlanOptions = {},
): Promise<MigrationPlan> {
    await useMigrationDataSource(dataSource);

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
            const { names: tables } = await readUserTableNames(dataSource, queryRunner, options.ignoreTables ?? []);

            if (tables.length > 0) {
                throw MigrationPlanError.populatedSchemaWithoutHistory(tables);
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

        // A baseline in the legacy set (a second squash) is never executed: its row
        // must exist, and the rows older than it are its own history.
        const legacyBaselines = legacy.filter((item) => isMigrationBaselineClass(item.instance?.constructor));
        const missingBaselines = legacyBaselines.filter((item) => !executedNames.has(item.name));
        const history = new Set<string>();

        for (const item of legacyBaselines) {
            if (executedNames.has(item.name)) {
                executed
                    .filter((row) => row.timestamp < item.timestamp)
                    .forEach((row) => history.add(row.name));
            }
        }

        const unknown = executed.filter((row) => !legacyNames.has(row.name) && !history.has(row.name));

        if (unknown.length > 0) {
            throw MigrationPlanError.unknownExecuted(unknown.map((row) => row.name), source.upgradeHint);
        }

        if (missingBaselines.length > 0) {
            throw MigrationPlanError.legacyMissing(missingBaselines[0]!.name, source.upgradeHint);
        }

        return {
            source,
            executed,
            legacy: withoutRow(legacy).filter((item) => !legacyBaselines.includes(item)),
            adopt: true,
            pending: withoutRow(source.current).filter((item) => item.timestamp > baseline.timestamp),
        };
    } finally {
        if (!options.queryRunner) {
            await queryRunner.release();
        }
    }
}

/**
 * @experimental The migration runner API may change in a minor release.
 */
export function isMigrationPlanEmpty(plan: MigrationPlan): boolean {
    return plan.legacy.length === 0 && !plan.adopt && plan.pending.length === 0;
}
