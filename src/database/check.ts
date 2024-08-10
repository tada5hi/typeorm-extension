import { DataSource, MigrationExecutor } from 'typeorm';
import {
    hasDataSource,
    setDataSource,
    unsetDataSource,
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
    context.dataSourceCleanup = context.dataSourceCleanup ?? true;

    const result : DatabaseCheckResult = {
        exists: true,
        schema: false,
        migrationsPending: [],
    };

    let { dataSource } = context;

    if (
        typeof dataSource === 'undefined' &&
        hasDataSource(context.alias)
    ) {
        // todo: data-source might get initialized here
        dataSource = await useDataSource(context.alias);
    }

    const dataSourceExisted = !!dataSource;

    if (typeof dataSource === 'undefined') {
        if (context.options) {
            dataSource = new DataSource({
                ...context.options,
                synchronize: false,
            });
        } else {
            const options = await useDataSourceOptions(context.alias);
            dataSource = new DataSource({
                ...options,
                synchronize: false,
            });
        }
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

    if (!dataSourceExisted) {
        if (context.dataSourceCleanup) {
            await dataSource.destroy();

            if (!context.dataSource) {
                unsetDataSource(context.alias);
            }
        } else {
            setDataSource(dataSource, context.alias);
        }
    }

    return result;
}
