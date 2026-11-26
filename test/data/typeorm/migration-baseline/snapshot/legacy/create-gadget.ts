import type { MigrationInterface, QueryRunner } from 'typeorm';
import { GADGET_TABLE, createGadgetTable } from '../schema';

export class CreateGadget1710000000001 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await createGadgetTable(queryRunner);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable(GADGET_TABLE);
    }
}
