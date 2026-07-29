import { DriverError } from '../../../../../src';
import { hasForeignKeyChecks, resolveSchemaDialect } from '../../../../../src/database/schema/alter/dialect';

describe('src/database/schema/alter/dialect', () => {
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
