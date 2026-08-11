import { EntityMetadataError, getEntityMetadata, validateEntityJoinColumns } from '../../../src';
import { Membership } from '../../data/entity/membership';
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

    it('should return the same object it was given', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        try {
            const payload : Partial<Tenant> = { region: 'eu', code: 'a' };
            const result = await validateEntityJoinColumns(payload, {
                dataSource,
                entityTarget: Tenant,
            });

            // The input is enriched in place, the return value is not a copy.
            expect(result).toBe(payload);
        } finally {
            await dataSource.destroy();
        }
    });

    it('should skip a relation whose join column the input does not define', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        try {
            const tenantRepository = dataSource.getRepository(Tenant);
            await tenantRepository.save(tenantRepository.create({ region: 'eu', code: 'a' }));

            const membership : Partial<Membership> = {};
            await validateEntityJoinColumns(membership, { dataSource, entityTarget: Membership });

            expect(membership.tenant).toBeUndefined();
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
