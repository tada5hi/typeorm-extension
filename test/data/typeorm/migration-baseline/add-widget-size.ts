import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn } from 'typeorm';

export class AddWidgetSize1700000000004 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('widget', new TableColumn({
            name: 'size', 
            type: 'integer', 
            isNullable: true, 
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('widget', 'size');
    }
}
