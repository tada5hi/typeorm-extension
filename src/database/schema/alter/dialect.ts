import type { DataSourceOptions } from 'typeorm';
import { DriverError } from '../../../errors';
import { hasOwnProperty } from '../../../utils';
import type { SchemaDialect } from './type';

/**
 * mariadb is served by the mysql statements, cockroachdb by the postgres ones.
 */
const dialects : Record<string, SchemaDialect> = {
    postgres: 'postgres',
    cockroachdb: 'postgres',
    mysql: 'mysql',
    mariadb: 'mysql',
};

/**
 * @throws DriverError
 */
export function resolveSchemaDialect(type: DataSourceOptions['type']) : SchemaDialect {
    if (hasOwnProperty(dialects, type)) {
        return dialects[type] as SchemaDialect;
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
