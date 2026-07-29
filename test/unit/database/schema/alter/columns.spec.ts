import { Table } from 'typeorm';
import { changeColumnType } from '../../../../../src';
import { FakeQueryRunner } from '../../../../data/typeorm/FakeQueryRunner';
import { createDataSource } from '../../../../data/typeorm/factory';
import { createTable } from '../../../../data/typeorm/table';

describe('src/database/schema/alter/columns', () => {
    it('should change the column type in place on mysql', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            tables: [createTable()],
        });

        const output = await changeColumnType(queryRunner as any, {
            table: 'user',
            column: 'roleId',
            from: {
                type: 'varchar',
                length: 36,
            },
            to: {
                type: 'varchar',
                length: 255,
            },
        });

        expect(output).toBeTruthy();
        expect(queryRunner.queries).toEqual([
            'ALTER TABLE `user` MODIFY COLUMN `roleId` varchar(255) NULL',
        ]);

        // typeorm's changeColumn drops & re-adds the column as soon as the
        // type or the length differs, which empties it
        expect(queryRunner.changedColumns).toEqual([]);
    });

    it('should restate the attributes of the column on mysql', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mariadb',
            tables: [createTable({
                columns: [
                    {
                        name: 'email',
                        type: 'varchar',
                        length: '36',
                        charset: 'utf8mb4',
                        collation: 'utf8mb4_bin',
                        default: '\'\'',
                        comment: 'the email',
                    },
                ],
            })],
        });

        const output = await changeColumnType(queryRunner as any, {
            table: 'user',
            column: 'email',
            from: {
                type: 'varchar',
                length: 36,
            },
            to: {
                type: 'varchar',
                length: 255,
            },
        });

        expect(output).toBeTruthy();
        expect(queryRunner.queries).toEqual([
            'ALTER TABLE `user` MODIFY COLUMN `email` varchar(255) ' +
            'CHARACTER SET \'utf8mb4\' COLLATE \'utf8mb4_bin\' NOT NULL ' +
            'DEFAULT \'\' COMMENT \'the email\'',
        ]);
    });

    it('should restate the auto increment of a primary key on mysql', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            tables: [createTable({
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                        unsigned: true,
                    },
                ],
            })],
        });

        const output = await changeColumnType(queryRunner as any, {
            table: 'user',
            column: 'id',
            from: { type: 'int' },
            to: { type: 'bigint' },
        });

        expect(output).toBeTruthy();
        expect(queryRunner.queries).toEqual([
            'ALTER TABLE `user` MODIFY COLUMN `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT',
        ]);
    });

    it('should keep the length if only the nullability changes', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            tables: [createTable()],
        });

        const output = await changeColumnType(queryRunner as any, {
            table: 'user',
            column: 'roleId',
            from: {
                type: 'varchar',
                nullable: true,
            },
            to: {
                type: 'varchar',
                nullable: false,
            },
        });

        expect(output).toBeTruthy();
        expect(queryRunner.queries).toEqual([
            'ALTER TABLE `user` MODIFY COLUMN `roleId` varchar(36) NOT NULL',
        ]);
    });

    it('should drop the length if the type changes without one', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            tables: [createTable()],
        });

        const output = await changeColumnType(queryRunner as any, {
            table: 'user',
            column: 'roleId',
            from: { type: 'varchar' },
            to: { type: 'text' },
        });

        expect(output).toBeTruthy();
        expect(queryRunner.queries).toEqual([
            'ALTER TABLE `user` MODIFY COLUMN `roleId` text NULL',
        ]);
    });

    it('should change the column type in place on postgres', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'postgres',
            tables: [new Table({
                name: 'user',
                columns: [
                    {
                        name: 'roleId',
                        type: 'character varying',
                        length: '36',
                        isNullable: true,
                    },
                ],
            })],
        });

        const output = await changeColumnType(queryRunner as any, {
            table: 'user',
            column: 'roleId',
            from: {
                type: 'varchar',
                length: 36,
            },
            to: {
                type: 'varchar',
                length: 255,
                nullable: false,
            },
        });

        expect(output).toBeTruthy();

        // the type is the one the driver normalized it to
        expect(queryRunner.queries).toEqual([
            'ALTER TABLE "user" ALTER COLUMN "roleId" TYPE character varying(255)',
            'ALTER TABLE "user" ALTER COLUMN "roleId" SET NOT NULL',
        ]);
        expect(queryRunner.changedColumns).toEqual([]);
    });

    it('should delegate to typeorm for a driver without statements', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'better-sqlite3',
            tables: [createTable()],
        });

        const output = await changeColumnType(queryRunner as any, {
            table: 'user',
            column: 'roleId',
            from: {
                type: 'varchar',
                length: 36,
            },
            to: {
                type: 'varchar',
                length: 255,
            },
        });

        expect(output).toBeTruthy();
        expect(queryRunner.queries).toEqual([]);
        expect(queryRunner.changedColumns.length).toEqual(1);
        expect(queryRunner.changedColumns[0].from).toEqual('roleId');
        expect(queryRunner.changedColumns[0].to.length).toEqual('255');
    });

    it('should be a no-op if the change is already applied', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            tables: [createTable()],
        });

        const output = await changeColumnType(queryRunner as any, {
            table: 'user',
            column: 'roleId',
            from: {
                type: 'varchar',
                length: 255,
            },
            to: {
                type: 'varchar',
                length: 36,
            },
        });

        expect(output).toBeFalsy();
        expect(queryRunner.queries).toEqual([]);
        expect(queryRunner.changedColumns).toEqual([]);
    });

    it('should be a no-op if the column matches neither description', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            tables: [createTable()],
        });

        const output = await changeColumnType(queryRunner as any, {
            table: 'user',
            column: 'roleId',
            from: { type: 'int' },
            to: { type: 'bigint' },
        });

        expect(output).toBeFalsy();
        expect(queryRunner.queries).toEqual([]);
        expect(queryRunner.changedColumns).toEqual([]);
    });

    it('should be a no-op if the column does not exist', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            tables: [createTable()],
        });

        const output = await changeColumnType(queryRunner as any, {
            table: 'user',
            column: 'foo',
            from: { type: 'varchar' },
            to: { type: 'text' },
        });

        expect(output).toBeFalsy();
    });

    it('should be a no-op if the table does not exist', async () => {
        const queryRunner = new FakeQueryRunner({ type: 'mysql' });

        const output = await changeColumnType(queryRunner as any, {
            table: 'foo',
            column: 'roleId',
            from: { type: 'varchar' },
            to: { type: 'text' },
        });

        expect(output).toBeFalsy();
    });

    it('should change the column type of a real data source', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();

        try {
            await dataSource.synchronize();

            const queryRunner = dataSource.createQueryRunner();
            const input = {
                table: 'user',
                column: 'email',
                from: { type: 'varchar' },
                to: {
                    type: 'text',
                    nullable: true,
                },
            };

            try {
                await queryRunner.query(
                    'INSERT INTO "user" ("firstName", "lastName", "email") VALUES (\'foo\', \'bar\', \'foo@bar.baz\')',
                );

                expect(await changeColumnType(queryRunner, input)).toBeTruthy();

                const table = await queryRunner.getTable('user');
                const column = table?.findColumnByName('email');

                expect(column?.type).toEqual('text');
                expect(column?.isNullable).toBeTruthy();

                // the values must survive the alteration
                const rows = await queryRunner.query('SELECT "email" FROM "user"');
                expect(rows).toEqual([{ email: 'foo@bar.baz' }]);

                // running it again is a no-op
                expect(await changeColumnType(queryRunner, input)).toBeFalsy();
            } finally {
                await queryRunner.release();
            }
        } finally {
            await dataSource.destroy();
        }
    });
});
