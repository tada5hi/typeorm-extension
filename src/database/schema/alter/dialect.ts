import type { DataSourceOptions } from 'typeorm';
import { DriverError } from '../../../errors';
import type { SchemaColumnDialect, SchemaDialect } from './type';

/**
 * mariadb is served by the mysql statements, cockroachdb by the postgres ones.
 *
 * A Map rather than a record, so a driver name which happens to be an
 * inherited property (`toString`) is a miss instead of a function.
 */
const dialects = new Map<string, SchemaDialect>([
    ['postgres', 'postgres'],
    ['cockroachdb', 'postgres'],
    ['mysql', 'mysql'],
    ['mariadb', 'mysql'],
]);

/**
 * mssql and oracle can not express either rename, but they can alter a column
 * in place — which typeorm otherwise does by dropping and re-adding it.
 */
const columnDialects = new Map<string, SchemaColumnDialect>([
    ...dialects,
    ['mssql', 'mssql'],
    ['oracle', 'oracle'],
]);

/**
 * The dialect to build a column alteration with, or undefined for a driver
 * this module has no statements for.
 */
export function findSchemaColumnDialect(
    type: DataSourceOptions['type'],
) : SchemaColumnDialect | undefined {
    return columnDialects.get(type);
}

/**
 * The dialect to build the rename statements with, or undefined for a driver
 * this module has none for.
 */
export function findSchemaDialect(type: DataSourceOptions['type']) : SchemaDialect | undefined {
    return dialects.get(type);
}

/**
 * @throws DriverError
 */
export function resolveSchemaDialect(type: DataSourceOptions['type']) : SchemaDialect {
    const dialect = findSchemaDialect(type);
    if (dialect) {
        return dialect;
    }

    throw DriverError.schemaAlterationNotSupported(type);
}

/**
 * mysql/mariadb are the only drivers with a session level switch
 * for the foreign key checks.
 */
export function hasForeignKeyChecks(type: DataSourceOptions['type']) : boolean {
    return type === 'mysql' || type === 'mariadb';
}
