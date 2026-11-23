import type { QueryRunner } from 'typeorm';
import { Table } from 'typeorm';
import { MigrationBaseline } from '../../../../src';

export class Baseline1700000000003 extends MigrationBaseline {
    static override legacy = ['test/data/typeorm/migration-baseline/legacy/*.ts'];

    static override upgradeHint = 'Upgrade through the previous release first.';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'widget',
            columns: [
                {
                    name: 'id',
                    type: 'integer',
                    isPrimary: true,
                },
                {
                    name: 'color',
                    type: 'varchar',
                    isNullable: true,
                },
            ],
        }));
    }
}
