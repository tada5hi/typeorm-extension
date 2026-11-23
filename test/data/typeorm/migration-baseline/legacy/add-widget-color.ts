import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn } from 'typeorm';

export class AddWidgetColor1700000000002 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('widget', new TableColumn({
            name: 'color', 
            type: 'varchar', 
            isNullable: true, 
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('widget', 'color');
    }
}
