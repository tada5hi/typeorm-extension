import { isEntityUnique } from '../../../src';
import { Account } from '../../data/entity/account';
import { Tenant } from '../../data/entity/tenant';
import { User } from '../../data/entity/user';
import { createDataSource } from '../../data/typeorm/factory';

describe('entity-uniqueness', () => {
    it('should check entity uniqueness', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const repository = dataSource.getRepository(User);
        const user = repository.create({
            firstName: 'foo',
            lastName: 'bar',
            email: 'foo@gmail.com',
        });
        await repository.save(user);

        let isUnique = await isEntityUnique({
            dataSource,
            entityTarget: User,
            entity: user,
        });
        expect(isUnique).toBeFalsy();

        isUnique = await isEntityUnique({
            dataSource,
            entityTarget: User,
            entity: user,
            entityExisting: user,
        });
        expect(isUnique).toBeTruthy();

        await dataSource.destroy();
    });

    it('should check entity uniqueness for columns with a distinct database name', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        try {
            const repository = dataSource.getRepository(Account);
            await repository.save(repository.create({
                userName: 'admin',
                tenantId: 1,
            }));

            const conflicting = await isEntityUnique({
                dataSource,
                entityTarget: Account,
                entity: { userName: 'admin', tenantId: 1 },
            });
            expect(conflicting).toBeFalsy();

            const free = await isEntityUnique({
                dataSource,
                entityTarget: Account,
                entity: { userName: 'admin', tenantId: 2 },
            });
            expect(free).toBeTruthy();
        } finally {
            await dataSource.destroy();
        }
    });

    it('should detect a conflict with a row sharing part of a composite primary key', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        try {
            const repository = dataSource.getRepository(Tenant);
            await repository.save(repository.create({
                region: 'eu', 
                code: 'a', 
                name: 'foo',
            }));
            const updated = await repository.save(repository.create({
                region: 'us', 
                code: 'a', 
                name: 'bar',
            }));

            // The conflicting row shares the code of the updated one, so
            // excluding it must compare the primary key as a whole.
            const conflicting = await isEntityUnique({
                dataSource,
                entityTarget: Tenant,
                entity: { name: 'foo' },
                entityExisting: updated,
            });
            expect(conflicting).toBeFalsy();

            const free = await isEntityUnique({
                dataSource,
                entityTarget: Tenant,
                entity: { name: 'baz' },
                entityExisting: updated,
            });
            expect(free).toBeTruthy();
        } finally {
            await dataSource.destroy();
        }
    });

    it('should keep persisted values for columns absent from a partial update', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        try {
            const repository = dataSource.getRepository(Account);
            const first = await repository.save(repository.create({
                userName: 'first',
                tenantId: 1,
            }));
            await repository.save(repository.create({
                userName: 'second',
                tenantId: 2,
            }));

            // Only displayName is updated, so the unique group keeps
            // userName/tenantId of the persisted row and stays unique.
            const untouched = await isEntityUnique({
                dataSource,
                entityTarget: Account,
                entity: { displayName: 'First Account' },
                entityExisting: first,
            });
            expect(untouched).toBeTruthy();

            // Moving the first account onto the second one's group conflicts.
            const conflicting = await isEntityUnique({
                dataSource,
                entityTarget: Account,
                entity: { userName: 'second', tenantId: 2 },
                entityExisting: first,
            });
            expect(conflicting).toBeFalsy();
        } finally {
            await dataSource.destroy();
        }
    });
});
