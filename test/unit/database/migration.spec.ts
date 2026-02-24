import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import { generateMigration } from '../../../src';
import { Role } from '../../data/entity/role';
import { User } from '../../data/entity/user';

describe('src/database/migration', () => {
    it('should generate migration file', async () => {
        const options : DataSourceOptions = {
            type: 'better-sqlite3',
            entities: [User, Role],
            database: ':memory:',
            extra: {
                charset: 'UTF8_GENERAL_CI',
            },
        };
        const dataSource = new DataSource(options);
        await dataSource.initialize();

        const output = await generateMigration({
            dataSource,
            preview: true,
        });

        await dataSource.destroy();

        expect(output).toBeDefined();
        expect(output.up).toBeDefined();
        expect(output.up.length).toBeGreaterThanOrEqual(1);
        expect(output.up[0]).toEqual('await queryRunner.query(`CREATE TABLE "role" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "name" varchar NOT NULL)`);');
        expect(output.up[1]).toEqual('await queryRunner.query(`CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "firstName" varchar NOT NULL, "lastName" varchar NOT NULL, "email" varchar NOT NULL, "roleId" integer, CONSTRAINT "UQ_c322cd2084cd4b1b2813a900320" UNIQUE ("firstName", "lastName"))`);');

        expect(output.down).toBeDefined();
        expect(output.down.length).toBeGreaterThanOrEqual(1);
        expect(output.down[0]).toEqual('await queryRunner.query(`ALTER TABLE "user" RENAME TO "temporary_user"`);');
    });
});
