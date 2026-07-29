import { Table } from 'typeorm';
import { changeColumnType } from '../../../../../src';
import { FakeQueryRunner } from '../../../../data/typeorm/FakeQueryRunner';
import { createDataSource } from '../../../../data/typeorm/factory';
import { createTable } from '../../../../data/typeorm/table';

describe('src/database/schema/alter/columns', () => {
    it('should change the column type', async () => {
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
        expect(queryRunner.changedColumns.length).toEqual(1);
        expect(queryRunner.changedColumns[0].from).toEqual('roleId');
        expect(queryRunner.changedColumns[0].to.type).toEqual('varchar');
        expect(queryRunner.changedColumns[0].to.length).toEqual('255');
        expect(queryRunner.changedColumns[0].to.isNullable).toBeTruthy();
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
        expect(queryRunner.changedColumns[0].to.length).toEqual('36');
        expect(queryRunner.changedColumns[0].to.isNullable).toBeFalsy();
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
        expect(queryRunner.changedColumns[0].to.type).toEqual('text');
        expect(queryRunner.changedColumns[0].to.length).toEqual('');
    });

    it('should change the nullability', async () => {
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
                nullable: true,
            },
            to: {
                type: 'varchar',
                length: 36,
                nullable: false,
            },
        });

        expect(output).toBeTruthy();
        expect(queryRunner.changedColumns[0].to.isNullable).toBeFalsy();
    });

    it('should normalize the type of the driver', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'postgres',
            tables: [new Table({
                name: 'user',
                columns: [
                    {
                        name: 'roleId',
                        type: 'character varying',
                        length: '36',
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
            },
        });

        expect(output).toBeTruthy();
        expect(queryRunner.changedColumns[0].to.type).toEqual('character varying');
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
                expect(await changeColumnType(queryRunner, input)).toBeTruthy();

                const table = await queryRunner.getTable('user');
                const column = table?.findColumnByName('email');

                expect(column?.type).toEqual('text');
                expect(column?.isNullable).toBeTruthy();

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
