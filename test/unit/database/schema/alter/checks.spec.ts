import {
    MYSQL_FOREIGN_KEY_CHECKS_OFF,
    MYSQL_FOREIGN_KEY_CHECKS_ON,
    MYSQL_FOREIGN_KEY_CHECKS_SELECT,
    withForeignKeyChecksDisabled,
} from '../../../../../src';
import { FakeQueryRunner } from '../../../../data/typeorm/FakeQueryRunner';

describe('src/database/schema/alter/checks', () => {
    it('should build the expected statements', () => {
        expect(MYSQL_FOREIGN_KEY_CHECKS_SELECT).toEqual('SELECT @@SESSION.foreign_key_checks AS `value`;');
        expect(MYSQL_FOREIGN_KEY_CHECKS_OFF).toEqual('SET FOREIGN_KEY_CHECKS=0;');
        expect(MYSQL_FOREIGN_KEY_CHECKS_ON).toEqual('SET FOREIGN_KEY_CHECKS=1;');
    });

    it('should disable and restore the checks on mysql', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            respond: () => [{ value: 1 }],
        });

        const output = await withForeignKeyChecksDisabled(
            queryRunner as any,
            async () => 'done',
        );

        expect(output).toEqual('done');
        expect(queryRunner.queries).toEqual([
            MYSQL_FOREIGN_KEY_CHECKS_SELECT,
            MYSQL_FOREIGN_KEY_CHECKS_OFF,
            MYSQL_FOREIGN_KEY_CHECKS_ON,
        ]);
    });

    it('should not restore checks which were already disabled', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            respond: () => [{ value: 0 }],
        });

        await withForeignKeyChecksDisabled(queryRunner as any, async () => 'done');

        expect(queryRunner.queries).toEqual([
            MYSQL_FOREIGN_KEY_CHECKS_SELECT,
            MYSQL_FOREIGN_KEY_CHECKS_OFF,
        ]);
    });

    it('should restore the checks if the previous state can not be read', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mysql',
            respond: () => undefined,
        });

        await withForeignKeyChecksDisabled(queryRunner as any, async () => 'done');

        expect(queryRunner.queries).toEqual([
            MYSQL_FOREIGN_KEY_CHECKS_SELECT,
            MYSQL_FOREIGN_KEY_CHECKS_OFF,
            MYSQL_FOREIGN_KEY_CHECKS_ON,
        ]);
    });

    it('should restore the checks if the callback throws', async () => {
        const queryRunner = new FakeQueryRunner({
            type: 'mariadb',
            respond: () => [{ value: 1 }],
        });

        await expect(withForeignKeyChecksDisabled(queryRunner as any, async () => {
            throw new Error('foo');
        })).rejects.toThrow('foo');

        expect(queryRunner.queries).toEqual([
            MYSQL_FOREIGN_KEY_CHECKS_SELECT,
            MYSQL_FOREIGN_KEY_CHECKS_OFF,
            MYSQL_FOREIGN_KEY_CHECKS_ON,
        ]);
    });

    it('should pass through on a driver without foreign key checks', async () => {
        const queryRunner = new FakeQueryRunner({ type: 'postgres' });

        const output = await withForeignKeyChecksDisabled(
            queryRunner as any,
            async () => 'done',
        );

        expect(output).toEqual('done');
        expect(queryRunner.queries).toEqual([]);
    });
});
