import type { DataSourceOptions } from 'typeorm';
import { DataSource, MigrationExecutor } from 'typeorm';
import {
    hasDataSource,
    useDataSource,
    useDataSourceOptions,
} from '../data-source';
import { hasStringProperty } from '../utils';
import type { DatabaseCheckContext, DatabaseCheckResult } from './type';

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

    if (
        typeof context.dataSource === 'undefined' &&
        typeof context.options === 'undefined' &&
        hasDataSource(context.alias)
    ) {
        // todo: data-source might get initialized here

        dataSource = await useDataSource(context.alias);
        dataSourceCleanup = false;
    } else {
        let dataSourceOptions : DataSourceOptions;
        if (context.options) {
            dataSourceOptions = context.options;
        } else {
            dataSourceOptions = await useDataSourceOptions(context.alias);
        }

        dataSource = new DataSource({
            ...dataSourceOptions,
            synchronize: true,
        });
        dataSourceCleanup = context.dataSourceCleanup ?? true;
    }

    try {
        if (!dataSource.isInitialized) {
            await dataSource.initialize();
        }
    } catch (e) {
        result.exists = false;

        return result;
    }

    const queryRunner = dataSource.createQueryRunner();

    if (
        dataSource.migrations &&
        dataSource.migrations.length > 0
    ) {
        const migrationExecutor = new MigrationExecutor(dataSource, queryRunner);
        result.migrationsPending = await migrationExecutor.getPendingMigrations();

        result.schema = result.migrationsPending.length === 0;
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

    await queryRunner.release();

    if (dataSourceCleanup) {
        await dataSource.destroy();
    }

    return result;
}
