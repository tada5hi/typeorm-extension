import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { DataSourceOptions, MigrationInterface } from 'typeorm';
import {
    Column,
    DataSource,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { generateMigration } from '../../../src';
import { Role } from '../../data/entity/role';
import { User } from '../../data/entity/user';

@Entity({ name: 'escaped' })
class Escaped {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ default: '`${danger}`\\' })
    text: string;
}

function createDataSource(entities: DataSourceOptions['entities']) : DataSource {
    return new DataSource({
        type: 'better-sqlite3',
        entities,
        database: ':memory:',
        extra: { charset: 'UTF8_GENERAL_CI' },
    });
}

const directoryPath = path.join(import.meta.dirname, '..', '..', '..', 'writable', 'migrations');

/**
 * Load the generated migration file and run its up-/down-method against a fresh database.
 */
async function executeMigrationFile(filePath: string) : Promise<void> {
    const exports = filePath.endsWith('.cjs') ?
        createRequire(import.meta.url)(filePath) :
        await import(filePath);

    // module.exports = class ... is the class itself, an esm module namespace holds it.
    const MigrationClass = (
        typeof exports === 'function' ?
            exports :
            Object.values(exports)[0]
    ) as new () => MigrationInterface;

    const migration = new MigrationClass();

    const dataSource = createDataSource([Role]);
    await dataSource.initialize();

    const queryRunner = dataSource.createQueryRunner();

    try {
        await migration.up(queryRunner);
        expect(await queryRunner.hasTable('role')).toBeTruthy();

        await migration.down(queryRunner);
        expect(await queryRunner.hasTable('role')).toBeFalsy();
    } finally {
        await queryRunner.release();
        await dataSource.destroy();
    }
}

describe('src/database/migration', () => {
    afterEach(async () => {
        await fs.promises.rm(directoryPath, { recursive: true, force: true });
    });

    it('should generate migration file', async () => {
        const dataSource = createDataSource([User, Role]);
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

    it('should generate typescript migration content', async () => {
        const dataSource = createDataSource([Role]);
        await dataSource.initialize();

        const output = await generateMigration({
            dataSource,
            name: 'add-role',
            timestamp: 1,
            preview: true,
        });

        await dataSource.destroy();

        expect(output.content).toContain('import { MigrationInterface, QueryRunner } from "typeorm";');
        expect(output.content).toContain('export class AddRole1 implements MigrationInterface {');
        expect(output.content).toContain('    public async up(queryRunner: QueryRunner): Promise<void> {');
        expect(output.content).toContain(`        ${output.up[0]}`);
    });

    it('should generate javascript migration content', async () => {
        const dataSource = createDataSource([Role]);
        await dataSource.initialize();

        const output = await generateMigration({
            dataSource,
            name: 'add-role',
            timestamp: 1,
            language: 'js',
            preview: true,
        });

        await dataSource.destroy();

        expect(output.content).toContain('module.exports = class AddRole1 {');
        expect(output.content).toContain('async up(queryRunner) {');
        expect(output.content).not.toContain('import { MigrationInterface, QueryRunner } from "typeorm";');
    });

    it('should generate javascript esm migration content', async () => {
        const dataSource = createDataSource([Role]);
        await dataSource.initialize();

        const output = await generateMigration({
            dataSource,
            name: 'add-role',
            timestamp: 1,
            language: 'js',
            esm: true,
            preview: true,
        });

        await dataSource.destroy();

        expect(output.content).toContain('export class AddRole1 {');
        expect(output.content).not.toContain('module.exports');
    });

    it('should write an executable typescript migration file', async () => {
        const dataSource = createDataSource([Role]);
        await dataSource.initialize();

        await generateMigration({
            dataSource,
            name: 'add-role',
            timestamp: 1,
            directoryPath,
        });

        await dataSource.destroy();

        const filePath = path.join(directoryPath, '1-add-role.ts');
        expect(fs.existsSync(filePath)).toBeTruthy();

        await executeMigrationFile(filePath);
    });

    it('should write an executable javascript esm migration file', async () => {
        const dataSource = createDataSource([Role]);
        await dataSource.initialize();

        await generateMigration({
            dataSource,
            name: 'add-role',
            timestamp: 1,
            language: 'js',
            esm: true,
            directoryPath,
        });

        await dataSource.destroy();

        const filePath = path.join(directoryPath, '1-add-role.js');
        expect(fs.existsSync(filePath)).toBeTruthy();

        await executeMigrationFile(filePath);
    });

    it('should write an executable javascript commonjs migration file', async () => {
        const dataSource = createDataSource([Role]);
        await dataSource.initialize();

        const output = await generateMigration({
            dataSource,
            name: 'add-role',
            timestamp: 1,
            language: 'js',
            directoryPath,
        });

        await dataSource.destroy();

        expect(fs.existsSync(path.join(directoryPath, '1-add-role.js'))).toBeTruthy();

        // the package is esm, so a commonjs migration only loads under the cjs extension.
        const filePath = path.join(directoryPath, '1-add-role.cjs');
        await fs.promises.writeFile(filePath, output.content as string);

        await executeMigrationFile(filePath);
    });

    it('should escape template literal characters', async () => {
        const dataSource = createDataSource([Escaped]);
        await dataSource.initialize();

        const output = await generateMigration({
            dataSource,
            preview: true,
        });

        await dataSource.destroy();

        const [statement] = output.up;
        expect(statement).toContain('\\`\\${danger}\\`\\\\');
        expect(statement).not.toContain('`${danger}`');
    });
});
