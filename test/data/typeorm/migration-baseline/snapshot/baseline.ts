import type { QueryRunner } from 'typeorm';
import { MigrationBaseline } from '../../../../../src';
import { AddGadgetLabelIndex1710000000002 } from './legacy/add-gadget-label-index';
import { CreateGadget1710000000001 } from './legacy/create-gadget';
import { createGadgetLabelIndex, createGadgetTable } from './schema';

/**
 * Squashes the gadget chain, expression index included.
 */
export class GadgetBaseline1710000000003 extends MigrationBaseline {
    static override legacy = [CreateGadget1710000000001, AddGadgetLabelIndex1710000000002];

    async up(queryRunner: QueryRunner): Promise<void> {
        await createGadgetTable(queryRunner);
        await createGadgetLabelIndex(queryRunner);
    }
}
