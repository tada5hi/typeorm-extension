import { describe, expect, it } from 'vitest';
import { DriverError, SchemaAlterationError, renameIndex } from '../../../../../src';
import { createFakeQueryRunner } from '../../../../data/typeorm/FakeQueryRunner';
import { createTable } from '../../../../data/typeorm/table';

describe('src/database/schema/alter/indices', () => {
    it('should rename the index on mysql', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'mysql',
            tables: [createTable({ indices: [{ name: 'IDX_from', columnNames: ['roleId'] }] })],
        });

        const output = await renameIndex(queryRunner, {
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
        const queryRunner = createFakeQueryRunner({
            type: 'postgres',
            tables: [createTable({ indices: [{ name: 'IDX_from', columnNames: ['roleId'] }] })],
        });

        const output = await renameIndex(queryRunner, {
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
        const queryRunner = createFakeQueryRunner({
            type: 'mysql',
            tables: [createTable({ indices: [{ name: 'IDX_to', columnNames: ['roleId'] }] })],
        });

        const output = await renameIndex(queryRunner, {
            table: 'user',
            from: 'IDX_from',
            to: 'IDX_to',
        });

        expect(output).toBeFalsy();
        expect(queryRunner.queries).toEqual([]);
    });

    it('should raise if neither index exists', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'mysql',
            tables: [createTable()],
        });

        // returning quietly would report a repair which did not happen
        await expect(renameIndex(queryRunner, {
            table: 'user',
            from: 'IDX_from',
            to: 'IDX_to',
        })).rejects.toThrow(SchemaAlterationError);

        expect(queryRunner.queries).toEqual([]);
    });

    it('should raise if the table does not exist', async () => {
        const queryRunner = createFakeQueryRunner({ type: 'mysql' });

        await expect(renameIndex(queryRunner, {
            table: 'user',
            from: 'IDX_from',
            to: 'IDX_to',
        })).rejects.toThrow(SchemaAlterationError);
    });

    it('should stay a no-op without strict', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'mysql',
            tables: [createTable()],
        });

        expect(await renameIndex(queryRunner, {
            table: 'user',
            from: 'IDX_from',
            to: 'IDX_to',
            strict: false,
        })).toBeFalsy();

        expect(await renameIndex(queryRunner, {
            table: 'unknown',
            from: 'IDX_from',
            to: 'IDX_to',
            strict: false,
        })).toBeFalsy();

        expect(queryRunner.queries).toEqual([]);
    });

    it('should throw for a driver which can not express the rename', async () => {
        const queryRunner = createFakeQueryRunner({ type: 'better-sqlite3' });

        await expect(renameIndex(queryRunner, {
            table: 'user',
            from: 'IDX_from',
            to: 'IDX_to',
        })).rejects.toThrow(DriverError);
    });
});
