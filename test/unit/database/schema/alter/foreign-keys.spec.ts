import {
    DriverError,
    MYSQL_FOREIGN_KEY_CHECKS_OFF,
    MYSQL_FOREIGN_KEY_CHECKS_ON,
    MYSQL_FOREIGN_KEY_CHECKS_SELECT,
    SchemaAlterationError,
    renameForeignKey,
} from '../../../../../src';
import { describe, expect, it } from 'vitest';
import { createFakeQueryRunner } from '../../../../data/typeorm/FakeQueryRunner';
import { TABLE_FOREIGN_KEYS, createTable } from '../../../../data/typeorm/table';

describe('src/database/schema/alter/foreign-keys', () => {
    it('should rename the constraint on postgres', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'postgres',
            tables: [createTable({ foreignKeys: TABLE_FOREIGN_KEYS })],
        });

        const output = await renameForeignKey(queryRunner, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
        });

        expect(output).toBeTruthy();
        expect(queryRunner.queries).toEqual([
            'ALTER TABLE "user" RENAME CONSTRAINT "FK_from" TO "FK_to"',
        ]);
    });

    it('should drop, rename the backing index and re-add the constraint on mysql', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'mysql',
            tables: [createTable({ foreignKeys: TABLE_FOREIGN_KEYS })],
            respond: (query, runner) => {
                if (query.includes('DROP FOREIGN KEY')) {
                    // mysql keeps the index it created under the constraint name
                    runner.setTable(createTable({ indices: [{ name: 'FK_from', columnNames: ['roleId'] }] }));
                }

                return [{ value: 1 }];
            },
        });

        const output = await renameForeignKey(queryRunner, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
        });

        expect(output).toBeTruthy();
        expect(queryRunner.queries).toEqual([
            MYSQL_FOREIGN_KEY_CHECKS_SELECT,
            MYSQL_FOREIGN_KEY_CHECKS_OFF,
            'ALTER TABLE `user` DROP FOREIGN KEY `FK_from`',
            'ALTER TABLE `user` RENAME INDEX `FK_from` TO `FK_to`',
            'ALTER TABLE `user` ADD CONSTRAINT `FK_to` FOREIGN KEY (`roleId`) ' +
            'REFERENCES `role` (`id`) ON DELETE CASCADE',
            MYSQL_FOREIGN_KEY_CHECKS_ON,
        ]);
    });

    it('should drop the backing index if the target index already exists on mysql', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'mysql',
            tables: [createTable({ foreignKeys: TABLE_FOREIGN_KEYS })],
            respond: (query, runner) => {
                if (query.includes('DROP FOREIGN KEY')) {
                    runner.setTable(createTable({
                        indices: [
                            { name: 'FK_from', columnNames: ['roleId'] },
                            { name: 'FK_to', columnNames: ['roleId'] },
                        ],
                    }));
                }

                return [{ value: 1 }];
            },
        });

        await renameForeignKey(queryRunner, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
        });

        expect(queryRunner.queries).toContain('ALTER TABLE `user` DROP INDEX `FK_from`');
        expect(queryRunner.queries).not.toContain(
            'ALTER TABLE `user` RENAME INDEX `FK_from` TO `FK_to`',
        );
    });

    it('should not touch indices if the column carried an explicit one on mysql', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'mysql',
            tables: [createTable({ foreignKeys: TABLE_FOREIGN_KEYS })],
            respond: (query, runner) => {
                if (query.includes('DROP FOREIGN KEY')) {
                    runner.setTable(createTable({ indices: [{ name: 'IDX_explicit', columnNames: ['roleId'] }] }));
                }

                return [{ value: 1 }];
            },
        });

        await renameForeignKey(queryRunner, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
        });

        expect(queryRunner.queries).toEqual([
            MYSQL_FOREIGN_KEY_CHECKS_SELECT,
            MYSQL_FOREIGN_KEY_CHECKS_OFF,
            'ALTER TABLE `user` DROP FOREIGN KEY `FK_from`',
            'ALTER TABLE `user` ADD CONSTRAINT `FK_to` FOREIGN KEY (`roleId`) ' +
            'REFERENCES `role` (`id`) ON DELETE CASCADE',
            MYSQL_FOREIGN_KEY_CHECKS_ON,
        ]);
    });

    it('should be a no-op if the rename is already applied', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'mysql',
            tables: [createTable({
                foreignKeys: [{
                    ...TABLE_FOREIGN_KEYS[0],
                    name: 'FK_to',
                }],
            })],
        });

        const output = await renameForeignKey(queryRunner, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
        });

        expect(output).toBeFalsy();
        expect(queryRunner.queries).toEqual([]);
    });

    it('should restore an interrupted rename from the passed meta', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'mysql',
            // neither name is present — the drop committed, the re-add did not
            tables: [createTable({ indices: [{ name: 'FK_from', columnNames: ['roleId'] }] })],
            respond: () => [{ value: 1 }],
        });

        const output = await renameForeignKey(queryRunner, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
            meta: {
                columns: ['roleId'],
                referencedTable: 'role',
                referencedColumns: ['id'],
                onDelete: 'CASCADE',
            },
        });

        expect(output).toBeTruthy();
        expect(queryRunner.queries).toEqual([
            MYSQL_FOREIGN_KEY_CHECKS_SELECT,
            MYSQL_FOREIGN_KEY_CHECKS_OFF,
            'ALTER TABLE `user` RENAME INDEX `FK_from` TO `FK_to`',
            'ALTER TABLE `user` ADD CONSTRAINT `FK_to` FOREIGN KEY (`roleId`) ' +
            'REFERENCES `role` (`id`) ON DELETE CASCADE',
            MYSQL_FOREIGN_KEY_CHECKS_ON,
        ]);
    });

    it('should not touch indices while restoring on postgres', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'postgres',
            tables: [createTable({ indices: [{ name: 'FK_from', columnNames: ['roleId'] }] })],
        });

        const output = await renameForeignKey(queryRunner, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
            meta: {
                columns: ['roleId'],
                referencedTable: 'role',
                referencedColumns: ['id'],
            },
        });

        expect(output).toBeTruthy();
        expect(queryRunner.queries).toEqual([
            'ALTER TABLE "user" ADD CONSTRAINT "FK_to" FOREIGN KEY ("roleId") REFERENCES "role" ("id")',
        ]);
    });

    it('should prefer the description of the database over the passed meta', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'postgres',
            tables: [createTable({ foreignKeys: TABLE_FOREIGN_KEYS })],
        });

        const output = await renameForeignKey(queryRunner, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
            meta: {
                columns: ['somethingElse'],
                referencedTable: 'other',
                referencedColumns: ['id'],
            },
        });

        expect(output).toBeTruthy();
        expect(queryRunner.queries).toEqual([
            'ALTER TABLE "user" RENAME CONSTRAINT "FK_from" TO "FK_to"',
        ]);
    });

    it('should raise for an interrupted rename without meta', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'mysql',
            tables: [createTable({ indices: [{ name: 'FK_from', columnNames: ['roleId'] }] })],
        });

        // the constraint took its description with it, so there is nothing
        // left to rename — reporting success would be a lie
        await expect(renameForeignKey(queryRunner, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
        })).rejects.toThrow(SchemaAlterationError);

        expect(queryRunner.queries).toEqual([]);
    });

    it('should raise if neither constraint exists', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'postgres',
            tables: [createTable()],
        });

        await expect(renameForeignKey(queryRunner, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
        })).rejects.toThrow(SchemaAlterationError);

        expect(queryRunner.queries).toEqual([]);
    });

    it('should raise if the table does not exist', async () => {
        const queryRunner = createFakeQueryRunner({ type: 'postgres' });

        await expect(renameForeignKey(queryRunner, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
        })).rejects.toThrow(SchemaAlterationError);
    });

    it('should stay a no-op without strict', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'postgres',
            tables: [createTable()],
        });

        expect(await renameForeignKey(queryRunner, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
            strict: false,
        })).toBeFalsy();

        expect(await renameForeignKey(queryRunner, {
            table: 'unknown',
            from: 'FK_from',
            to: 'FK_to',
            strict: false,
        })).toBeFalsy();

        expect(queryRunner.queries).toEqual([]);
    });

    it('should throw for a driver which can not express the rename', async () => {
        const queryRunner = createFakeQueryRunner({ type: 'oracle' });

        await expect(renameForeignKey(queryRunner, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
        })).rejects.toThrow(DriverError);
    });
});
