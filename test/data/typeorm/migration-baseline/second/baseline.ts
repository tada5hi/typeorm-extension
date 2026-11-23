import type { QueryRunner } from 'typeorm';
import { Table } from 'typeorm';
import { MigrationBaseline } from '../../../../../src';
import { AddWidgetSize1700000000004 } from '../add-widget-size';
import { Baseline1700000000003 } from '../baseline';

/**
 * A second squash: replaces the first baseline and the migration after it.
 */
export class SecondBaseline1700000000005 extends MigrationBaseline {
    static override legacy = [Baseline1700000000003, AddWidgetSize1700000000004];

    static override upgradeHint = 'Upgrade through the release carrying Baseline1700000000003 first.';

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
                {
                    name: 'size',
                    type: 'integer',
                    isNullable: true,
                },
            ],
        }));
    }
}
