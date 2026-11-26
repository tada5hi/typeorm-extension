import type { QueryRunner } from 'typeorm';
import { MigrationBaseline } from '../../../../../src';
import { AddGadgetLabelIndex1710000000002 } from './legacy/add-gadget-label-index';
import { CreateGadget1710000000001 } from './legacy/create-gadget';
import { createGadgetTable } from './schema';

/**
 * A faulty squash of the gadget chain: the expression index is forgotten.
 */
export class GadgetBaselineWithoutIndex1710000000003 extends MigrationBaseline {
    static override legacy = [CreateGadget1710000000001, AddGadgetLabelIndex1710000000002];

    async up(queryRunner: QueryRunner): Promise<void> {
        await createGadgetTable(queryRunner);
    }
}
