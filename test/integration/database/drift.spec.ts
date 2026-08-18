import type { DataSource } from 'typeorm';
import { DataSource as TypeORMDataSource } from 'typeorm';
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
} from 'vitest';
import { assertSchemaMatchesMetadata, getSchemaDrift } from '../../../src';
import { Role } from '../../data/entity/role';
import { User } from '../../data/entity/user';
import {
    createIntegrationDataSourceOptions,
    supportsSchemaMetadata,
    useIntegrationDriver,
} from '../../data/typeorm/integration';

const driver = useIntegrationDriver();

describe.runIf(supportsSchemaMetadata(driver))(`src/database/schema/drift (${driver})`, () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = new TypeORMDataSource(
            createIntegrationDataSourceOptions([User, Role]),
        );

        await dataSource.initialize();

        // start from a known state without dropping the whole schema —
        // oracle refuses that from within a pluggable database
        const queryRunner = dataSource.createQueryRunner();
        try {
            await queryRunner.dropTable('user', true, true, true);
            await queryRunner.dropTable('role', true, true, true);
        } finally {
            await queryRunner.release();
        }

        await dataSource.synchronize(false);
    });

    afterAll(async () => {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    it('should not detect drift for a synchronized schema', async () => {
        const drift = await getSchemaDrift(dataSource);

        expect(drift.exists).toBeFalsy();
        expect(drift.up).toEqual([]);
    });

    it('should not throw for a synchronized schema', async () => {
        await expect(assertSchemaMatchesMetadata(dataSource)).resolves.toBeUndefined();
    });

    it('should skip a data source without migrations', async () => {
        const drift = await getSchemaDrift(dataSource, { skipWithoutMigrations: true });

        expect(drift.exists).toBeFalsy();
    });

    it('should build its own data source from options', async () => {
        const drift = await getSchemaDrift(
            createIntegrationDataSourceOptions([User, Role]),
        );

        expect(drift.exists).toBeFalsy();
    });

    it('should detect a column which deviates from the metadata', async () => {
        const queryRunner = dataSource.createQueryRunner();

        try {
            const table = await queryRunner.getTable('user');
            const column = table!.findColumnByName('email')!;
            const next = column.clone();
            next.length = '64';

            await queryRunner.changeColumn(table!, column, next);

            try {
                const drift = await getSchemaDrift(dataSource);

                expect(drift.exists).toBeTruthy();
                expect(drift.up.length).toBeGreaterThan(0);

                await expect(assertSchemaMatchesMetadata(dataSource)).rejects.toThrow();
            } finally {
                await queryRunner.changeColumn('user', 'email', column);
            }

            expect((await getSchemaDrift(dataSource)).exists).toBeFalsy();
        } finally {
            await queryRunner.release();
        }
    });
});
