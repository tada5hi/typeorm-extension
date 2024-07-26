import { isEntityUnique } from '../../../src';
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
    });
});
