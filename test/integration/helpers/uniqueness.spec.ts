import type { DataSource, EntityTarget } from 'typeorm';
import { DataSource as TypeORMDataSource } from 'typeorm';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';
import { isEntityUnique } from '../../../src';
import { IndexedKeyedRecord } from '../../data/entity/indexed-keyed-record';
import { KeyedRecord } from '../../data/entity/keyed-record';
import {
    createIntegrationDataSourceOptions,
    supportsSchemaMetadata,
    useIntegrationDriver,
} from '../../data/typeorm/integration';

const driver = useIntegrationDriver();

type KeyedRow = { id: number, externalKey: string | null };

/**
 * Whether the database itself accepts the row, which is what the
 * check has to predict.
 */
async function isAccepted(
    dataSource: DataSource,
    target: EntityTarget<KeyedRow>,
    externalKey: string | null,
) : Promise<boolean> {
    const repository = dataSource.getRepository(target);

    try {
        await repository.save(repository.create({ externalKey }));

        return true;
    } catch {
        return false;
    }
}

describe.runIf(supportsSchemaMetadata(driver))(`src/helpers/entity/uniqueness (${driver})`, () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = new TypeORMDataSource(createIntegrationDataSourceOptions([KeyedRecord, IndexedKeyedRecord]));
        await dataSource.initialize();
    });

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            await dataSource.destroy();
        }
    });

    beforeEach(async () => {
        const queryRunner = dataSource.createQueryRunner();

        try {
            await queryRunner.dropTable('keyed_records', true);
            await queryRunner.dropTable('indexed_keyed_records', true);
        } finally {
            await queryRunner.release();
        }

        await dataSource.synchronize(false);
    });

    const targets : [string, EntityTarget<KeyedRow>][] = [
        ['unique constraint', KeyedRecord],
        ['unique index', IndexedKeyedRecord],
    ];

    for (const [label, target] of targets) {
        it(`should agree with the database on a second null (${label})`, async () => {
            expect(await isAccepted(dataSource, target, null)).toBeTruthy();

            const unique = await isEntityUnique({
                dataSource,
                entityTarget: target,
                entity: { externalKey: null },
            });

            expect(unique).toBe(await isAccepted(dataSource, target, null));
        });

        it(`should agree with the database on a taken value (${label})`, async () => {
            expect(await isAccepted(dataSource, target, 'taken')).toBeTruthy();

            const unique = await isEntityUnique({
                dataSource,
                entityTarget: target,
                entity: { externalKey: 'taken' },
            });

            expect(unique).toBeFalsy();
            expect(await isAccepted(dataSource, target, 'taken')).toBeFalsy();
        });
    }
});
