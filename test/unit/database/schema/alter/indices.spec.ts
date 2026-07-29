import { DriverError, renameIndex } from '../../../../../src';
import { FakeQueryRunner } from '../../../../data/typeorm/FakeQueryRunner';
import { createTable } from '../../../../data/typeorm/table';

describe('src/database/schema/alter/indices', () => {
    it('should rename the index on mysql', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            tables: [createTable({ indices: [{ name: 'IDX_from', columnNames: ['roleId'] }] })],
        });

        const output = await renameIndex(queryRunner as any, {
            table: 'user',
            from: 'IDX_from',
            to: 'IDX_to',
        });

        expect(output).toBeTruthy();
        expect(queryRunner.queries).toEqual([
            'ALTER TABLE `user` RENAME INDEX `IDX_from` TO `IDX_to`',
        ]);
    });

    it('should rename the index on postgres', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'postgres',
            tables: [createTable({ indices: [{ name: 'IDX_from', columnNames: ['roleId'] }] })],
        });

        const output = await renameIndex(queryRunner as any, {
            table: 'user',
            from: 'IDX_from',
            to: 'IDX_to',
        });

        expect(output).toBeTruthy();
        expect(queryRunner.queries).toEqual([
            'ALTER INDEX "IDX_from" RENAME TO "IDX_to"',
        ]);
    });

    it('should be a no-op if the rename is already applied', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            tables: [createTable({ indices: [{ name: 'IDX_to', columnNames: ['roleId'] }] })],
        });

        const output = await renameIndex(queryRunner as any, {
            table: 'user',
            from: 'IDX_from',
            to: 'IDX_to',
        });

        expect(output).toBeFalsy();
        expect(queryRunner.queries).toEqual([]);
    });

    it('should be a no-op if the index does not exist', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            tables: [createTable()],
        });

        const output = await renameIndex(queryRunner as any, {
            table: 'user',
            from: 'IDX_from',
            to: 'IDX_to',
        });

        expect(output).toBeFalsy();
        expect(queryRunner.queries).toEqual([]);
    });

    it('should be a no-op if the table does not exist', async () => {
        const queryRunner = new FakeQueryRunner({ type: 'mysql' });

        const output = await renameIndex(queryRunner as any, {
            table: 'user',
            from: 'IDX_from',
            to: 'IDX_to',
        });

        expect(output).toBeFalsy();
        expect(queryRunner.queries).toEqual([]);
    });

    it('should throw for a driver which can not express the rename', async () => {
        const queryRunner = new FakeQueryRunner({ type: 'better-sqlite3' });

        await expect(renameIndex(queryRunner as any, {
            table: 'user',
            from: 'IDX_from',
            to: 'IDX_to',
        })).rejects.toThrow(DriverError);
    });
});
