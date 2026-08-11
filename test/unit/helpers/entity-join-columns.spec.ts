import { EntityRelationLookupError, validateEntityJoinColumns } from '../../../src';
import { Membership } from '../../data/entity/membership';
import { Tenant } from '../../data/entity/tenant';
import { Role } from '../../data/entity/role';
import { User } from '../../data/entity/user';
import { createDataSource } from '../../data/typeorm/factory';

describe('entity-relation-columns', () => {
    it('should validate entity relation columns', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const roleRepository = dataSource.getRepository(Role);
        const role = roleRepository.create({ name: 'foo' });

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

    it('should validate entity nullable relation columns', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const userRepository = dataSource.getRepository(User);
        const user = userRepository.create({
            firstName: 'foo',
            lastName: 'bar',
            email: 'foo@gmail.com',
            roleId: null,
        });

        await validateEntityJoinColumns(user, { dataSource, entityTarget: User });

        expect(user.roleId).toBeFalsy();
        expect(user.role).toBeUndefined();
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

    it('should resolve a fully provided composite relation', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        try {
            const tenantRepository = dataSource.getRepository(Tenant);
            await tenantRepository.save(tenantRepository.create({ region: 'eu', code: 'a' }));

            const membership : Partial<Membership> = { tenantRegion: 'eu', tenantCode: 'a' };
            await validateEntityJoinColumns(membership, { dataSource, entityTarget: Membership });

            expect(membership.tenant).toBeDefined();
            expect(membership.tenant.region).toEqual('eu');
        } finally {
            await dataSource.destroy();
        }
    });

    it('should skip a composite relation which is only partially provided', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        try {
            const tenantRepository = dataSource.getRepository(Tenant);
            await tenantRepository.save(tenantRepository.create({ region: 'eu', code: 'a' }));

            // Only one half of the composite foreign key is set. Looking the
            // relation up by that half alone would match an unrelated tenant.
            const membership : Partial<Membership> = { tenantRegion: 'eu' };
            await validateEntityJoinColumns(membership, { dataSource, entityTarget: Membership });

            expect(membership.tenant).toBeUndefined();
        } finally {
            await dataSource.destroy();
        }
    });
});
