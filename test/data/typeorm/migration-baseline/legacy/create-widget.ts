import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table } from 'typeorm';

export class CreateWidget1700000000001 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'widget',
            columns: [{
                name: 'id', 
                type: 'integer', 
                isPrimary: true, 
            }],
        }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('widget');
    }
}
