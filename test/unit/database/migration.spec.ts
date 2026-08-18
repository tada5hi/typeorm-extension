import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { DataSource, DataSourceOptions, MigrationInterface } from 'typeorm';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
    afterEach,
    describe,
    expect,
    it,
} from 'vitest';
import { generateMigration } from '../../../src';
import { Role } from '../../data/entity/role';
import { User } from '../../data/entity/user';
import { createDataSource, createDataSourceOptions } from '../../data/typeorm/factory';

@Entity({ name: 'escaped' })
class Escaped {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ default: '`${danger}`\\' })
    text: string;
}

const directoryPath = path.join(import.meta.dirname, '..', '..', '..', 'writable', 'migrations');

/**
 * Run a callback against an initialized data source, restricted to the given entities so the
 * generated statements stay predictable. The data source is destroyed even if the callback throws.
 */
async function withDataSource<T>(
    entities: DataSourceOptions['entities'],
    fn: (dataSource: DataSource) => Promise<T>,
) : Promise<T> {
    const dataSource = createDataSource({
        ...createDataSourceOptions(),
        entities,
    });

    await dataSource.initialize();

    try {
        return await fn(dataSource);
    } finally {
        await dataSource.destroy();
    }
}

/**
 * Load the generated migration file and run its up-/down-method against a fresh database.
 * Every table of the given entities must exist after up() and be gone again after down().
 */
async function executeMigrationFile(
    filePath: string,
    entities: DataSourceOptions['entities'] = [Role],
) : Promise<void> {
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

    await withDataSource(entities, async (dataSource) => {
        const tableNames = dataSource.entityMetadatas.map((metadata) => metadata.tableName);
        const queryRunner = dataSource.createQueryRunner();

        try {
            await migration.up(queryRunner);
            for (const tableName of tableNames) {
                expect(await queryRunner.hasTable(tableName)).toBeTruthy();
            }

            await migration.down(queryRunner);
            for (const tableName of tableNames) {
                expect(await queryRunner.hasTable(tableName)).toBeFalsy();
            }
        } finally {
            await queryRunner.release();
        }
    });
}

describe('src/database/migration', () => {
    afterEach(async () => {
        await fs.promises.rm(directoryPath, { recursive: true, force: true });
    });

    it('should generate migration file', async () => {
        const output = await withDataSource([User, Role], (dataSource) => generateMigration({
            dataSource,
            preview: true,
        }));

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
        const output = await withDataSource([Role], (dataSource) => generateMigration({
            dataSource,
            name: 'add-role',
            timestamp: 1,
            preview: true,
        }));

        expect(output.content).toContain('import { MigrationInterface, QueryRunner } from "typeorm";');
        expect(output.content).toContain('export class AddRole1 implements MigrationInterface {');
        expect(output.content).toContain('    public async up(queryRunner: QueryRunner): Promise<void> {');
        expect(output.content).toContain(`        ${output.up[0]}`);
    });

    it('should generate javascript migration content', async () => {
        const output = await withDataSource([Role], (dataSource) => generateMigration({
            dataSource,
            name: 'add-role',
            timestamp: 1,
            language: 'js',
            preview: true,
        }));

        expect(output.content).toContain('module.exports = class AddRole1 {');
        expect(output.content).toContain('async up(queryRunner) {');
        expect(output.content).not.toContain('import { MigrationInterface, QueryRunner } from "typeorm";');
    });

    it('should generate javascript esm migration content', async () => {
        const output = await withDataSource([Role], (dataSource) => generateMigration({
            dataSource,
            name: 'add-role',
            timestamp: 1,
            language: 'js',
            esm: true,
            preview: true,
        }));

        expect(output.content).toContain('export class AddRole1 {');
        expect(output.content).not.toContain('module.exports');
    });

    it('should generate migration with an explicit zero timestamp', async () => {
        const output = await withDataSource([Role], (dataSource) => generateMigration({
            dataSource,
            name: 'add-role',
            timestamp: 0,
            preview: true,
        }));

        expect(output.content).toContain('export class AddRole0 implements MigrationInterface {');
    });

    it('should write an executable typescript migration file', async () => {
        await withDataSource([Role], (dataSource) => generateMigration({
            dataSource,
            name: 'add-role',
            timestamp: 1,
            directoryPath,
        }));

        const filePath = path.join(directoryPath, '1-add-role.ts');
        expect(fs.existsSync(filePath)).toBeTruthy();

        await executeMigrationFile(filePath);
    });

    it('should write an executable javascript esm migration file', async () => {
        await withDataSource([Role], (dataSource) => generateMigration({
            dataSource,
            name: 'add-role',
            timestamp: 1,
            language: 'js',
            esm: true,
            directoryPath,
        }));

        const filePath = path.join(directoryPath, '1-add-role.js');
        expect(fs.existsSync(filePath)).toBeTruthy();

        await executeMigrationFile(filePath);
    });

    it('should write an executable javascript commonjs migration file', async () => {
        const output = await withDataSource([Role], (dataSource) => generateMigration({
            dataSource,
            name: 'add-role',
            timestamp: 1,
            language: 'js',
            directoryPath,
        }));

        expect(fs.existsSync(path.join(directoryPath, '1-add-role.js'))).toBeTruthy();

        // the package is esm, so a commonjs migration only loads under the cjs extension.
        const filePath = path.join(directoryPath, '1-add-role.cjs');
        await fs.promises.writeFile(filePath, output.content as string);

        await executeMigrationFile(filePath);
    });

    it('should write an executable migration for dependent tables', async () => {
        await withDataSource([User, Role], (dataSource) => generateMigration({
            dataSource,
            name: 'add-user',
            timestamp: 1,
            directoryPath,
        }));

        const filePath = path.join(directoryPath, '1-add-user.ts');
        expect(fs.existsSync(filePath)).toBeTruthy();

        // The foreign key makes sqlite rebuild the table instead of just creating it, so down()
        // is a chain of statements which depend on each other. It only succeeds when they run in
        // the reverse order of up(); a single-table migration cannot tell the two orders apart.
        await executeMigrationFile(filePath, [User, Role]);
    });

    it('should escape template literal characters', async () => {
        const output = await withDataSource([Escaped], (dataSource) => generateMigration({
            dataSource,
            preview: true,
        }));

        const [statement] = output.up;
        expect(statement).toContain('\\`\\${danger}\\`\\\\');
        expect(statement).not.toContain('`${danger}`');
    });
});
