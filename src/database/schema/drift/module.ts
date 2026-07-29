import type { DataSource, DataSourceOptions } from 'typeorm';
import { SchemaDriftError } from '../../../errors';
import { useInitializedDataSource } from '../utils';
import type { SchemaDrift, SchemaDriftOptions, SchemaDriftStatement } from './type';

function toStatement(query: { query: string, parameters?: any[] }) : SchemaDriftStatement {
    if (query.parameters && query.parameters.length > 0) {
        return {
            query: query.query,
            parameters: query.parameters,
        };
    }

    return { query: query.query };
}

function buildEmptyDrift() : SchemaDrift {
    return {
        exists: false,
        up: [],
        down: [],
    };
}

/**
 * Compare the database schema against the entity metadata and return the
 * statements which would reconcile the former with the latter.
 *
 * A schema which is built by migrations in production but by synchronize()
 * in tests has no guard against the two descriptions drifting apart. Run this
 * right after the migrations to close that gap:
 *
 * ```ts
 * const drift = await getSchemaDrift(dataSource);
 * if (drift.exists) {
 *     console.log(drift.up.map((statement) => statement.query));
 * }
 * ```
 *
 * The inspection itself never writes to the database. A data source built from
 * the passed options is therefore built with `synchronize`, `migrationsRun` and
 * `dropSchema` disabled — an already existing DataSource is initialized as is,
 * so its own options still apply.
 */
export async function getSchemaDrift(
    input: DataSource | DataSourceOptions,
    options: SchemaDriftOptions = {},
) : Promise<SchemaDrift> {
    const { dataSource, owned } = await useInitializedDataSource(input, {
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
    });

    try {
        if (options.skipWithoutMigrations && dataSource.migrations.length === 0) {
            return buildEmptyDrift();
        }

        const sqlInMemory = await dataSource.driver.createSchemaBuilder().log();

        const up = sqlInMemory.upQueries.map(toStatement);
        const down = sqlInMemory.downQueries.map(toStatement);

        return {
            exists: up.length > 0,
            up,
            down,
        };
    } finally {
        if (owned) {
            await dataSource.destroy();
        }
    }
}

/**
 * Throw if the database schema deviates from the entity metadata.
 *
 * @throws SchemaDriftError
 */
export async function assertSchemaMatchesMetadata(
    input: DataSource | DataSourceOptions,
    options: SchemaDriftOptions = {},
) : Promise<void> {
    const drift = await getSchemaDrift(input, options);

    if (drift.exists) {
        throw SchemaDriftError.detected(drift.up);
    }
}
