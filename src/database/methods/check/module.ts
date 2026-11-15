import type { DataSourceOptions } from 'typeorm';
import { DataSource, MigrationExecutor } from 'typeorm';
import { useDataSourceOptions } from '../../../data-source';
import { useRuntimeRegistry } from '../../../runtime';
import { hasStringProperty } from '../../../utils';
import { isDatabaseNotFoundError } from '../../error/module';
import type { DatabaseCheckContext, DatabaseCheckResult } from './types';

/**
 * A data source for the check alone. typeorm's initialize() would
 * otherwise synchronize, run migrations or drop the schema.
 */
function createCheckDataSource(options: DataSourceOptions) : DataSource {
    return new DataSource({
        ...options,
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
    });
}

/**
 * Check database setup progress.
 *
 * @param context
 */
export async function checkDatabase(context: DatabaseCheckContext = {}) : Promise<DatabaseCheckResult> {
    const result : DatabaseCheckResult = {
        exists: true,
        schema: false,
        migrationsPending: [],
    };

    let dataSource : DataSource;
    let dataSourceCleanup : boolean;

    let candidate = context.dataSource;

    if (
        typeof candidate === 'undefined' &&
        typeof context.options === 'undefined'
    ) {
        // read the registry without initializing: useDataSource() would.
        candidate = useRuntimeRegistry().dataSources.get(context.alias || 'default');
    }

    if (candidate) {
        if (candidate.isInitialized) {
            dataSource = candidate;
            dataSourceCleanup = false;
        } else {
            // the candidate is never touched, the check runs on a copy.
            dataSource = createCheckDataSource(candidate.options);
            dataSourceCleanup = true;
        }
    } else {
        let dataSourceOptions : DataSourceOptions;

        if (context.options) {
            dataSourceOptions = context.options;
        } else {
            dataSourceOptions = await useDataSourceOptions(context.alias);
        }

        dataSource = createCheckDataSource(dataSourceOptions);
        dataSourceCleanup = context.dataSourceCleanup ?? true;
    }

    try {
        if (!dataSource.isInitialized) {
            await dataSource.initialize();
        }
    } catch {
        result.exists = false;

        return result;
    }

    const queryRunner = dataSource.createQueryRunner();

    try {
        if (
            dataSource.migrations &&
            dataSource.migrations.length > 0
        ) {
            const migrationExecutor = new MigrationExecutor(dataSource, queryRunner);

            result.migrationsPending = await migrationExecutor.getPendingMigrations();

            result.schema = result.migrationsPending.length === 0;
        } else if (dataSource.options.type === 'mongodb') {
            // mongodb has no tables to probe, collections appear on first write.
            result.schema = true;
        } else {
            let schema : string | undefined;

            if (hasStringProperty(dataSource.driver.options, 'schema')) {
                schema = dataSource.driver.options.schema;
            }

            const migrationsTableName = dataSource.driver.buildTableName(
                dataSource.options.migrationsTableName || 'migrations',
                schema,
                dataSource.driver.database,
            );
            const migrationsTableExists = await queryRunner.hasTable(migrationsTableName);

            if (migrationsTableExists) {
                result.schema = dataSource.entityMetadatas.length === 0;
            } else {
                const tableNames = dataSource.entityMetadatas.map(
                    (entityMetadata) => entityMetadata.tablePath,
                );
                const tables = await queryRunner.getTables(tableNames);

                if (tables.length === dataSource.entityMetadatas.length) {
                    const { upQueries } = await dataSource.driver.createSchemaBuilder()
                        .log();

                    result.schema = upQueries.length === 0;
                } else {
                    result.schema = false;
                }
            }
        }
    } catch (e) {
        // cockroachdb connects to a missing database and fails on the first query.
        if (isDatabaseNotFoundError(e)) {
            return {
                exists: false,
                schema: false,
                migrationsPending: [],
            };
        }

        throw e;
    } finally {
        await queryRunner.release();

        if (dataSourceCleanup) {
            await dataSource.destroy();
        }
    }

    return result;
}
