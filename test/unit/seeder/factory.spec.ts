import type { DataSource } from 'typeorm';
import {
    resetSeederFactoryManager,
    setSeederFactory,
    useSeederFactory,
    useSeederFactoryManager,
} from '../../../src';
import { Role } from '../../data/entity/role';
import { User } from '../../data/entity/user';
import { destroyTestFsDataSource, setupFsDataSource } from '../../data/typeorm/utils';
import userFactoryItem from '../../data/factory/user';

describe('src/seeder/factory/index.ts', () => {
    let dataSource : DataSource;
    beforeEach(async () => {
        dataSource = await setupFsDataSource('factory');
    });

    afterEach(async () => {
        await destroyTestFsDataSource(dataSource);
    });

    it('should create & save seed', async () => {
        const user = await useSeederFactory(User).save();
        expect(user).toBeDefined();
        expect(user.id).toBeDefined();
    });

    it('should create & save many seeds', async () => {
        const users = await useSeederFactory(User).saveMany(3);
        expect(users).toBeDefined();
        expect(users.length).toEqual(3);

        for (const user of users) {
            expect(user.id).toBeDefined();
        }
    });

    it('should pass meta to the factory callback', async () => {
        type RoleMeta = { name: string };

        setSeederFactory(Role, (meta?: RoleMeta) => {
            const role = new Role();
            role.name = meta?.name ?? 'fallback';

            return role;
        });

        try {
            const role = await useSeederFactory<Role, RoleMeta>(Role)
                .setMeta({ name: 'admin' })
                .make();

            expect(role.name).toEqual('admin');

            const unset = await useSeederFactory<Role, RoleMeta>(Role).make();
            expect(unset.name).toEqual('fallback');
        } finally {
            delete useSeederFactoryManager().items[Role.name];
        }
    });

    it('should resolve nested factories and thenable properties', async () => {
        setSeederFactory(Role, () => {
            const role = new Role();
            role.name = 'nested';

            return role;
        });

        setSeederFactory(User, () => {
            const user = new User();
            user.firstName = 'nested';
            user.lastName = 'nested';
            user.email = { then: (resolve: (value: string) => void) => resolve('nested@example.com') } as unknown as string;
            user.role = useSeederFactory(Role) as unknown as Role;

            return user;
        });

        try {
            const made = await useSeederFactory(User).make();
            expect(made.role).toBeInstanceOf(Role);
            expect(made.email).toEqual('nested@example.com');

            const saved = await useSeederFactory(User).save();
            expect(saved.id).toBeDefined();
            expect(saved.role).toBeInstanceOf(Role);
            expect(saved.role.id).toBeDefined();
        } finally {
            setSeederFactory(User, userFactoryItem.factoryFn);
            delete useSeederFactoryManager().items[Role.name];
        }
    });

    it('should reset the factory manager', () => {
        setSeederFactory(Role, () => new Role());

        const manager = useSeederFactoryManager();
        expect(manager.items.Role).toBeDefined();

        resetSeederFactoryManager();

        const next = useSeederFactoryManager();
        expect(next).not.toBe(manager);
        expect(next.items.Role).toBeUndefined();
    });
});
