import { EntityRelationLookupError, validateEntityJoinColumns } from '../../../src';
import { Role } from '../../data/entity/role';
import { User } from '../../data/entity/user';
import { createDataSource } from '../../data/typeorm/factory';

describe('entity-relation-columns', () => {
    it('should validate entity relation columns', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const roleRepository = dataSource.getRepository(Role);
        const role = roleRepository.create({
            name: 'foo',
        });

        await roleRepository.save(role);

        const userRepository = dataSource.getRepository(User);
        const user = userRepository.create({
            firstName: 'foo',
            lastName: 'bar',
            email: 'foo@gmail.com',
            roleId: role.id,
        });

        await validateEntityJoinColumns(user, { dataSource, entityTarget: User });

        expect(user.role).toBeDefined();

        await dataSource.destroy();
    });

    it('should not validate entity relation columns', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const userRepository = dataSource.getRepository(User);
        const user = userRepository.create({
            firstName: 'foo',
            lastName: 'bar',
            email: 'foo@gmail.com',
            roleId: 1000,
        });

        expect.assertions(3);

        try {
            await validateEntityJoinColumns(user, { dataSource, entityTarget: User });
        } catch (e) {
            expect(e).toBeDefined();

            if (e instanceof EntityRelationLookupError) {
                expect(e.relation).toEqual('role');
                expect(e.columns).toEqual(['roleId']);
            }
        }

        await dataSource.destroy();
    });
});
