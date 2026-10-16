import type { EntitySubscriberInterface, UpdateEvent } from 'typeorm';
import { DataSource, EventSubscriber, IsNull } from 'typeorm';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { DriverError, OptionsError, withLockedEntity } from '../../../../src';
import { Role } from '../../../data/entity/role';
import { User } from '../../../data/entity/user';
import { createDataSource, createDataSourceOptions } from '../../../data/typeorm/factory';

const updates : string[] = [];

@EventSubscriber()
class RoleSubscriber implements EntitySubscriberInterface<Role> {
    listenTo() {
        return Role;
    }

    afterUpdate(event: UpdateEvent<Role>) {
        updates.push(event.entity?.name);
    }
}

describe('src/database/lock/entity', () => {
    let dataSource : DataSource;

    beforeEach(async () => {
        updates.length = 0;
        dataSource = createDataSource({
            ...createDataSourceOptions(),
            subscribers: [RoleSubscriber],
            synchronize: true,
        });
        await dataSource.initialize();
        await dataSource.getRepository(Role).insert({ id: 1, name: 'draft' });
    });

    afterEach(async () => {
        await dataSource.destroy();
    });

    async function readName() : Promise<string | undefined> {
        const role = await dataSource.getRepository(Role).findOneBy({ id: 1 });
        return role?.name;
    }

    it('should refuse an unsupported driver before opening a transaction', async () => {
        const spy = vi.spyOn(dataSource.manager, 'transaction');
        const fn = vi.fn();

        await expect(withLockedEntity(dataSource, Role, { id: 1 }, fn))
            .rejects.toBeInstanceOf(DriverError);

        expect(spy).not.toHaveBeenCalled();
        expect(fn).not.toHaveBeenCalled();
    });

    it('should run unlocked if not strict and persist the writes', async () => {
        const output = await withLockedEntity(dataSource, Role, { id: 1 }, async (role, manager) => {
            role.name = 'published';
            await manager.save(role);

            return 'done';
        }, { strict: false });

        expect(output).toEqual('done');
        expect(await readName()).toEqual('published');
        expect(updates).toEqual(['published']);
    });

    it('should roll back if the callback throws', async () => {
        await expect(withLockedEntity(dataSource, Role, { id: 1 }, async (role, manager) => {
            role.name = 'published';
            await manager.save(role);

            throw new Error('boom');
        }, { strict: false })).rejects.toThrow('boom');

        expect(await readName()).toEqual('draft');
    });

    it('should resolve null without calling the callback for a missing row', async () => {
        const fn = vi.fn();

        await expect(withLockedEntity(dataSource, Role, { id: 2 }, fn, { strict: false }))
            .resolves.toBeNull();

        expect(fn).not.toHaveBeenCalled();
    });

    it('should reuse the transaction of an entity manager', async () => {
        await dataSource.transaction(async (manager) => {
            const spy = vi.spyOn(manager.queryRunner!, 'startTransaction');

            const output = await withLockedEntity(manager, Role, { id: 1 }, async (role, inner) => {
                expect(inner).toBe(manager);

                return role.name;
            }, { strict: false });

            expect(output).toEqual('draft');
            expect(spy).not.toHaveBeenCalled();
        });
    });

    it('should refuse a lookup through a relation, but not a find operator on it', async () => {
        const fn = vi.fn();

        await expect(withLockedEntity(dataSource, User, { role: { id: 1 } }, fn, { strict: false }))
            .rejects.toBeInstanceOf(OptionsError);
        expect(fn).not.toHaveBeenCalled();

        await expect(withLockedEntity(dataSource, User, { role: IsNull() }, fn, { strict: false }))
            .resolves.toBeNull();
    });

    it('should refuse nowait on mssql', async () => {
        const mssql = new DataSource({ type: 'mssql', host: '127.0.0.1' });
        const spy = vi.spyOn(mssql.manager, 'transaction');

        await expect(withLockedEntity(mssql, Role, { id: 1 }, vi.fn(), { onLocked: 'nowait' }))
            .rejects.toBeInstanceOf(DriverError);

        expect(spy).not.toHaveBeenCalled();
    });
});
