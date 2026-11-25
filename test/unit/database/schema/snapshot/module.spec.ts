import fs from 'node:fs';
import path from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { DataSource, EntitySchema } from 'typeorm';
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { getSchemaSnapshot } from '../../../../../src';
import { CreateWidget1700000000001 } from '../../../../data/typeorm/migration-baseline/legacy/create-widget';

const directory = path.join(import.meta.dirname, '..', '..', '..', '..', '..', 'writable', 'schema-snapshot');

const files: string[] = [];

function databaseFile(): string {
    fs.mkdirSync(directory, { recursive: true });

    const file = path.join(directory, `${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);

    files.push(file);

    return file;
}

function optionsOf(database: string, extra: Partial<DataSourceOptions> = {}): DataSourceOptions {
    return {
        type: 'better-sqlite3',
        database,
        ...extra,
    } as DataSourceOptions;
}

async function exec(database: string, statements: string[]) {
    const dataSource = new DataSource(optionsOf(database));

    await dataSource.initialize();

    for (const statement of statements) {
        await dataSource.query(statement);
    }

    await dataSource.destroy();
}

const FIXTURE = [
    'CREATE TABLE "team" ("id" integer PRIMARY KEY NOT NULL, "name" varchar(64) NOT NULL DEFAULT (\'x\'), CONSTRAINT "UQ_team_name" UNIQUE ("name"))',
    'CREATE TABLE "member" ("id" integer NOT NULL, "slug" varchar NOT NULL, "teamId" integer, "age" integer, CONSTRAINT "PK_member" PRIMARY KEY ("id", "slug"), CONSTRAINT "CK_member_age" CHECK ("age" > 0), CONSTRAINT "FK_member_team" FOREIGN KEY ("teamId") REFERENCES "team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)',
    'CREATE INDEX "IDX_member_age" ON "member" ("age")',
    'CREATE UNIQUE INDEX "IDX_member_team_slug" ON "member" ("teamId", "slug") WHERE "age" IS NOT NULL',
];

afterEach(() => {
    for (const file of files.splice(0)) {
        fs.rmSync(file, { force: true });
    }
});

describe('database/schema/snapshot', () => {
    it('reads columns, primary key, indices, uniques, checks and foreign keys', async () => {
        const database = databaseFile();

        await exec(database, FIXTURE);

        const snapshot = await getSchemaSnapshot(optionsOf(database));

        expect(snapshot.views).toEqual([]);
        expect(snapshot.tables.map((table) => table.name)).toEqual(['member', 'team']);

        const [member, team] = snapshot.tables;

        expect(member.primaryKey?.columns).toEqual(['id', 'slug']);
        expect(member.columns.map((column) => column.name)).toEqual(['age', 'id', 'slug', 'teamId']);
        expect(member.columns.find((column) => column.name === 'teamId')).toMatchObject({
            isNullable: true,
            length: null,
            default: null,
            enum: null,
        });
        expect(member.checks).toEqual([expect.objectContaining({ name: 'CK_member_age' })]);
        expect(member.checks[0].expression).toContain('age');
        expect(member.foreignKeys).toEqual([{
            name: 'FK_member_team',
            columns: ['teamId'],
            referencedTable: 'team',
            referencedColumns: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'NO ACTION',
        }]);
        expect(member.indices).toEqual(expect.arrayContaining([
            {
                name: 'IDX_member_age',
                columns: ['age'],
                isUnique: false,
                where: null,
                kind: null,
                definition: null,
            },
            expect.objectContaining({
                name: 'IDX_member_team_slug',
                columns: ['teamId', 'slug'],
                isUnique: true,
            }),
        ]));

        expect(team.columns.find((column) => column.name === 'name')).toMatchObject({
            length: '64',
            isNullable: false,
        });
        expect(team.uniques.some((unique) => unique.columns.join() === 'name')).toBe(true);
    });

    it('omits schema and database qualifiers', async () => {
        const database = databaseFile();

        await exec(database, FIXTURE);

        const snapshot = await getSchemaSnapshot(optionsOf(database));

        for (const table of snapshot.tables) {
            expect(table.name).not.toContain('.');

            for (const foreignKey of table.foreignKeys) {
                expect(foreignKey.referencedTable).not.toContain('.');
            }
        }
    });

    it('excludes the migrations and metadata tables', async () => {
        const database = databaseFile();
        const dataSource = new DataSource(optionsOf(database, { migrations: [CreateWidget1700000000001] }));

        await dataSource.initialize();
        await dataSource.runMigrations();
        await dataSource.destroy();

        const snapshot = await getSchemaSnapshot(optionsOf(database));
        const names = snapshot.tables.map((table) => table.name);

        expect(names.length).toBeGreaterThan(0);
        expect(names).not.toContain('migrations');
        expect(names).not.toContain('typeorm_metadata');
    });

    it('ignoreTables excludes a foreign table', async () => {
        const database = databaseFile();

        await exec(database, FIXTURE);

        const snapshot = await getSchemaSnapshot(optionsOf(database), { ignoreTables: ['team'] });

        expect(snapshot.tables.map((table) => table.name)).toEqual(['member']);
    });

    it('sorts every list', async () => {
        const database = databaseFile();

        await exec(database, [
            'CREATE TABLE "zeta" ("z" integer, "a" integer, "m" integer)',
            'CREATE INDEX "IDX_b" ON "zeta" ("m")',
            'CREATE INDEX "IDX_a" ON "zeta" ("a")',
            'CREATE TABLE "alpha" ("id" integer)',
        ]);

        const snapshot = await getSchemaSnapshot(optionsOf(database));

        expect(snapshot.tables.map((table) => table.name)).toEqual(['alpha', 'zeta']);
        expect(snapshot.tables[1].columns.map((column) => column.name)).toEqual(['a', 'm', 'z']);
        expect(snapshot.tables[1].indices.map((index) => index.name)).toEqual(['IDX_a', 'IDX_b']);
    });

    it('is read-only', async () => {
        const database = databaseFile();

        const snapshot = await getSchemaSnapshot(optionsOf(database, {
            synchronize: true,
            migrationsRun: true,
            entities: [new EntitySchema({ name: 'gadget', columns: { id: { type: Number, primary: true } } })],
        }));

        expect(snapshot.tables).toEqual([]);
        expect(snapshot.views).toEqual([]);

        const check = new DataSource(optionsOf(database));

        await check.initialize();

        const rows = await check.query('SELECT name FROM sqlite_master WHERE type = \'table\'');

        await check.destroy();

        expect(rows).toEqual([]);
    });

    it('uses a given query runner without releasing it', async () => {
        const database = databaseFile();

        await exec(database, FIXTURE);

        const dataSource = new DataSource(optionsOf(database));

        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();

        const snapshot = await getSchemaSnapshot(dataSource, { queryRunner });

        expect(snapshot.tables).toHaveLength(2);
        expect(queryRunner.isReleased).toBe(false);

        await queryRunner.release();
        await dataSource.destroy();
    });

    it('does not read views without a metadata table', async () => {
        const database = databaseFile();

        await exec(database, FIXTURE);

        const dataSource = new DataSource(optionsOf(database));

        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();
        const getViews = vi.spyOn(queryRunner, 'getViews');

        const snapshot = await getSchemaSnapshot(dataSource, { queryRunner });

        expect(getViews).not.toHaveBeenCalled();
        expect(snapshot.views).toEqual([]);

        await queryRunner.release();
        await dataSource.destroy();
    });

    it('reads views recorded in the metadata table and leaves the metadata table out', async () => {
        const database = databaseFile();
        const Gadget = new EntitySchema({
            name: 'gadget',
            columns: { id: { type: Number, primary: true }, label: { type: String } },
        });
        const GadgetView = new EntitySchema({
            name: 'gadget_view',
            expression: 'SELECT "id", "label" FROM "gadget"',
            columns: { id: { type: Number, primary: true } },
            type: 'view',
        } as any);

        const source = new DataSource(optionsOf(database, { entities: [Gadget, GadgetView], synchronize: true }));

        await source.initialize();
        await source.destroy();

        const snapshot = await getSchemaSnapshot(optionsOf(database));

        expect(snapshot.tables.map((table) => table.name)).toEqual(['gadget']);
        expect(snapshot.views).toEqual([{
            name: 'gadget_view',
            expression: 'SELECT "id", "label" FROM "gadget"',
            materialized: false,
        }]);
    });
});
