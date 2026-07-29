import {
    DriverError,
    MYSQL_FOREIGN_KEY_CHECKS_OFF,
    MYSQL_FOREIGN_KEY_CHECKS_ON,
    MYSQL_FOREIGN_KEY_CHECKS_SELECT,
    renameForeignKey,
} from '../../../../../src';
import { FakeQueryRunner } from '../../../../data/typeorm/FakeQueryRunner';
import { TABLE_FOREIGN_KEYS, createTable } from '../../../../data/typeorm/table';

describe('src/database/schema/alter/foreign-keys', () => {
    it('should rename the constraint on postgres', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'postgres',
            tables: [createTable({ foreignKeys: TABLE_FOREIGN_KEYS })],
        });

        const output = await renameForeignKey(queryRunner as any, {
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
        const queryRunner = new FakeQueryRunner({
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

        const output = await renameForeignKey(queryRunner as any, {
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
        const queryRunner = new FakeQueryRunner({
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

        await renameForeignKey(queryRunner as any, {
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
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            tables: [createTable({ foreignKeys: TABLE_FOREIGN_KEYS })],
            respond: (query, runner) => {
                if (query.includes('DROP FOREIGN KEY')) {
                    runner.setTable(createTable({ indices: [{ name: 'IDX_explicit', columnNames: ['roleId'] }] }));
                }

                return [{ value: 1 }];
            },
        });

        await renameForeignKey(queryRunner as any, {
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
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            tables: [createTable({
                foreignKeys: [{
                    ...TABLE_FOREIGN_KEYS[0],
                    name: 'FK_to',
                }],
            })],
        });

        const output = await renameForeignKey(queryRunner as any, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
        });

        expect(output).toBeFalsy();
        expect(queryRunner.queries).toEqual([]);
    });

    it('should be a no-op if the constraint does not exist', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'postgres',
            tables: [createTable()],
        });

        const output = await renameForeignKey(queryRunner as any, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
        });

        expect(output).toBeFalsy();
        expect(queryRunner.queries).toEqual([]);
    });

    it('should be a no-op if the table does not exist', async () => {
        const queryRunner = new FakeQueryRunner({ type: 'postgres' });

        const output = await renameForeignKey(queryRunner as any, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
        });

        expect(output).toBeFalsy();
        expect(queryRunner.queries).toEqual([]);
    });

    it('should throw for a driver which can not express the rename', async () => {
        const queryRunner = new FakeQueryRunner({ type: 'oracle' });

        await expect(renameForeignKey(queryRunner as any, {
            table: 'user',
            from: 'FK_from',
            to: 'FK_to',
        })).rejects.toThrow(DriverError);
    });
});
