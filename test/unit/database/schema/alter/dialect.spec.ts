import { DriverError } from '../../../../../src';
import {
    findSchemaDialect,
    hasForeignKeyChecks,
    resolveSchemaDialect,
} from '../../../../../src/database/schema/alter/dialect';

describe('src/database/schema/alter/dialect', () => {
    describe('findSchemaDialect', () => {
        it('should find supported drivers', () => {
            expect(findSchemaDialect('postgres')).toEqual('postgres');
            expect(findSchemaDialect('cockroachdb')).toEqual('postgres');
            expect(findSchemaDialect('mysql')).toEqual('mysql');
            expect(findSchemaDialect('mariadb')).toEqual('mysql');
        });

        it('should stay undefined for a driver without statements', () => {
            expect(findSchemaDialect('better-sqlite3')).toBeUndefined();
            expect(findSchemaDialect('mssql')).toBeUndefined();
            expect(findSchemaDialect('mongodb')).toBeUndefined();
            expect(findSchemaDialect('toString' as any)).toBeUndefined();
        });
    });

    describe('resolveSchemaDialect', () => {
        it('should resolve supported drivers', () => {
            expect(resolveSchemaDialect('postgres')).toEqual('postgres');
            expect(resolveSchemaDialect('cockroachdb')).toEqual('postgres');
            expect(resolveSchemaDialect('mysql')).toEqual('mysql');
            expect(resolveSchemaDialect('mariadb')).toEqual('mysql');
        });

        it('should throw for a driver which can not express a rename', () => {
            expect(() => resolveSchemaDialect('better-sqlite3')).toThrow(DriverError);
            expect(() => resolveSchemaDialect('mssql')).toThrow(DriverError);
            expect(() => resolveSchemaDialect('oracle')).toThrow(DriverError);
            expect(() => resolveSchemaDialect('mongodb')).toThrow(DriverError);
        });

        it('should not resolve inherited properties', () => {
            expect(() => resolveSchemaDialect('toString' as any)).toThrow(DriverError);
        });
    });

    describe('hasForeignKeyChecks', () => {
        it('should detect drivers with a session level switch', () => {
            expect(hasForeignKeyChecks('mysql')).toBeTruthy();
            expect(hasForeignKeyChecks('mariadb')).toBeTruthy();
            expect(hasForeignKeyChecks('postgres')).toBeFalsy();
            expect(hasForeignKeyChecks('better-sqlite3')).toBeFalsy();
        });
    });
});
