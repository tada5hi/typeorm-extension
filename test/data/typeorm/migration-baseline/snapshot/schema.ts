import type { QueryRunner } from 'typeorm';
import { Table } from 'typeorm';

export const GADGET_TABLE = 'gadget';

export const GADGET_LABEL_INDEX = 'UQ_gadget_label';

export async function createGadgetTable(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
        name: GADGET_TABLE,
        columns: [
            {
                name: 'id',
                type: 'integer',
                isPrimary: true,
            },
            {
                name: 'label',
                type: 'varchar',
                length: '100',
                isNullable: true,
            },
        ],
    }));
}

/**
 * A unique expression index over COALESCE(label, ''), created by raw DDL: typeorm does not model it.
 * mariadb has no functional key parts and typeorm fails reading a generated column it did not create
 * (it looks the expression up in typeorm_metadata), so mariadb gets a prefix index, which typeorm
 * does not model either.
 */
export async function createGadgetLabelIndex(queryRunner: QueryRunner): Promise<void> {
    switch (queryRunner.connection.options.type) {
        case 'mariadb': {
            await queryRunner.query(`CREATE UNIQUE INDEX \`${GADGET_LABEL_INDEX}\` ON \`${GADGET_TABLE}\` (\`label\`(10))`);

            break;
        }
        case 'mysql': {
            await queryRunner.query(`CREATE UNIQUE INDEX \`${GADGET_LABEL_INDEX}\` ON \`${GADGET_TABLE}\` ((COALESCE(\`label\`, '')))`);

            break;
        }
        default: {
            await queryRunner.query(`CREATE UNIQUE INDEX "${GADGET_LABEL_INDEX}" ON "${GADGET_TABLE}" (COALESCE("label", ''))`);
        }
    }
}
