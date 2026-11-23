import type { DataSourceOptions, Migration } from 'typeorm';
import { DataSource } from 'typeorm';
import { MigrationPlanError } from '../../errors';
import type { MigrationRunOptions } from './migration';
import { MIGRATION_LOCK_NAME, runDatabaseMigrations } from './migration';
import { scanMigrationSource } from './migration/source';
import { useInitializedDataSource } from './utils';

async function refuseInitializeFlagsOnBaseline(input: DataSource | DataSourceOptions) : Promise<void> {
    if (input instanceof DataSource && input.isInitialized) {
        return;
    }

    const options = input instanceof DataSource ? input.options : input;
    const flags = (['synchronize', 'dropSchema'] as const).filter((flag) => !!options[flag]);

    if (flags.length === 0 || !options.migrations || Object.keys(options.migrations).length === 0) {
        return;
    }

    const source = await scanMigrationSource(input instanceof DataSource ? input : new DataSource(options));

    if (source.baseline) {
        throw MigrationPlanError.dataSourceInitializeRuns(flags);
    }
}

export async function synchronizeDatabaseSchema(
    input: DataSource | DataSourceOptions,
    options: Pick<MigrationRunOptions, 'transaction' | 'ignoreTables'> & {
        /**
         * true takes MIGRATION_LOCK_NAME, a string takes that name.
         *
         * Default: no lock
         */
        lock?: boolean | string
    } = {},
) : Promise<Migration[]> {
    // initialize() would synchronize or drop before the baseline checks run.
    await refuseInitializeFlagsOnBaseline(input);

    // typeorm's own runner in initialize() knows no baselines and takes no lock.
    const { dataSource, owned } = await useInitializedDataSource(input, { migrationsRun: false });

    try {
        const { options: dataSourceOptions } = dataSource;

        let migrationsCount = 0;

        if (dataSourceOptions.migrations) {
            migrationsCount = Array.isArray(dataSourceOptions.migrations) ?
                dataSourceOptions.migrations.length :
                Object.keys(dataSourceOptions.migrations).length;
        }

        if (migrationsCount > 0) {
            return await runDatabaseMigrations(dataSource, {
                transaction: options.transaction,
                lock: options.lock === true ? MIGRATION_LOCK_NAME : (options.lock || false),
                ignoreTables: options.ignoreTables,
            });
        }

        await dataSource.synchronize(false);

        return [];
    } finally {
        if (owned) {
            await dataSource.destroy();
        }
    }
}
