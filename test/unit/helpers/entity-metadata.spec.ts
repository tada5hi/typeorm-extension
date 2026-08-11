import { EntityMetadataError, getEntityMetadata } from '../../../src';
import { User } from '../../data/entity/user';
import { createDataSource } from '../../data/typeorm/factory';

describe('src/helpers/entity/metadata.ts', () => {
    it('should resolve metadata for a repository and an entity target', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();

        try {
            const repository = dataSource.getRepository(User);

            const fromRepository = await getEntityMetadata(repository);
            expect(fromRepository.target).toEqual(User);

            const fromTarget = await getEntityMetadata(User, dataSource);
            expect(fromTarget.target).toEqual(User);
        } finally {
            await dataSource.destroy();
        }
    });

    it('should throw a typed error for an unregistered entity', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();

        try {
            class Unknown {}

            await expect(getEntityMetadata(Unknown, dataSource))
                .rejects
                .toBeInstanceOf(EntityMetadataError);
        } finally {
            await dataSource.destroy();
        }
    });
});
