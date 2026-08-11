import { EntityMetadataError, getEntityMetadata, validateEntityJoinColumns } from '../../../src';
import { Tenant } from '../../data/entity/tenant';
import { createDataSource } from '../../data/typeorm/factory';

describe('entity-target-edge-cases', () => {
    it('should not resolve a relation which owns no join columns', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        try {
            const repository = dataSource.getRepository(Tenant);
            await repository.save(repository.create({ region: 'eu', code: 'a' }));

            // Tenant.memberships is the inverse side of the relation, so it
            // owns no join columns. Without a condition to look it up by, any
            // row of the referenced table would match.
            const payload : Partial<Tenant> = { region: 'us', code: 'b' };
            await validateEntityJoinColumns(payload, { dataSource, entityTarget: Tenant });

            expect(payload.memberships).toBeUndefined();
        } finally {
            await dataSource.destroy();
        }
    });

    it('should throw a typed error for an unregistered object-form entity target', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();

        try {
            class Unknown {}

            // EntityTarget also covers { type, name }, which must not be
            // constructed to build the error message.
            const target = { type: Unknown, name: 'Unknown' } as any;

            await expect(getEntityMetadata(target, dataSource))
                .rejects
                .toBeInstanceOf(EntityMetadataError);
        } finally {
            await dataSource.destroy();
        }
    });
});
