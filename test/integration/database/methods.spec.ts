import {
    afterAll,
    describe,
    expect,
    it,
} from 'vitest';
import { checkDatabase, createDatabase, dropDatabase } from '../../../src';
import { Role } from '../../data/entity/role';
import { User } from '../../data/entity/user';
import {
    createIntegrationDataSourceOptions,
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
    // mongodb has no relational schema, so the fixtures do not apply to it
    const entities = supportsSchemaMetadata(driver) ? [User, Role] : [];
    const options = createIntegrationDataSourceOptions(entities, { database: 'typeorm_extension_integration' });

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

        // checkDatabase inspects the schema, which the mongodb query runner
        // does not implement ("Check schema queries are not supported")
        if (supportsSchemaMetadata(driver)) {
            expect(await checkDatabase({ options })).toMatchObject({
                exists: true,
                schema: true,
            });
        }

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
});
