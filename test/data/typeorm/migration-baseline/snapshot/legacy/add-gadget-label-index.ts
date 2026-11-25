import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
    GADGET_LABEL_INDEX,
    GADGET_TABLE,
    createGadgetLabelIndex,
} from '../schema';

export class AddGadgetLabelIndex1710000000002 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await createGadgetLabelIndex(queryRunner);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex(GADGET_TABLE, GADGET_LABEL_INDEX);
    }
}
