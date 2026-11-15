import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
} from 'vitest';
import { checkDatabase, createDatabase, dropDatabase } from '../../../src';
import { Role } from '../../data/entity/role';
import { User } from '../../data/entity/user';
import {
    createIntegrationDataSourceOptions,
    supportsDatabaseCharset,
    supportsDatabaseDrop,
    supportsDatabaseExistenceCheck,
    supportsSchemaMetadata,
    useIntegrationDriver,
} from '../../data/typeorm/integration';

const driver = useIntegrationDriver();

/**
 * Exercises src/database/adapters against a real server — the native client
 * glue is the one part of the create/drop path the default suite can only fake.
 */
describe.runIf(driver && supportsDatabaseDrop(driver))(`src/database/methods (${driver})`, () => {
    // vitest evaluates the body of a skipped suite, so the options have to be built
    // in a hook. createIntegrationDataSourceOptions throws without a configured driver.
    let options : DataSourceOptions;

    beforeAll(() => {
        // mongodb has no relational schema, so the fixtures do not apply to it
        const entities = supportsSchemaMetadata(driver) ? [User, Role] : [];

        options = createIntegrationDataSourceOptions(entities, { database: 'typeorm_extension_integration' });
    });

    afterAll(async () => {
        await dropDatabase({
            options,
            ifExist: true,
        });
    });

    it('should create and drop a database', async () => {
        await dropDatabase({
            options,
            ifExist: true,
        });

        await createDatabase({
            options,
            ifNotExist: true,
            synchronize: supportsSchemaMetadata(driver),
        });

        expect(await checkDatabase({ options })).toMatchObject({
            exists: true,
            schema: true,
        });

        await dropDatabase({
            options,
            ifExist: true,
        });

        if (supportsDatabaseExistenceCheck(driver)) {
            expect(await checkDatabase({ options })).toMatchObject({ exists: false });
        }
    });

    it('should be idempotent', async () => {
        await createDatabase({
            options,
            ifNotExist: true,
            synchronize: false,
        });

        await createDatabase({
            options,
            ifNotExist: true,
            synchronize: false,
        });

        await dropDatabase({
            options,
            ifExist: true,
        });

        await dropDatabase({
            options,
            ifExist: true,
        });
    });

    it.runIf(supportsDatabaseCharset(driver))('should create a database with a plain character set name', async () => {
        const database = 'typeorm_extension_integration_charset';
        const charsetOptions = createIntegrationDataSourceOptions([], { database, charset: 'utf8mb4' });

        await dropDatabase({ options: charsetOptions, ifExist: true });

        try {
            await createDatabase({
                options: charsetOptions,
                ifNotExist: true,
                synchronize: false,
            });

            const dataSource = new DataSource(charsetOptions);

            await dataSource.initialize();

            try {
                const rows = await dataSource.query(
                    'SELECT DEFAULT_CHARACTER_SET_NAME AS `value` FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
                    [database],
                );

                expect(rows[0].value).toEqual('utf8mb4');
            } finally {
                await dataSource.destroy();
            }
        } finally {
            await dropDatabase({ options: charsetOptions, ifExist: true });
        }
    });
});
