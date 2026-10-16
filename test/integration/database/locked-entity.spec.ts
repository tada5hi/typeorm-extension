import type { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';
import { EventSubscriber, DataSource as TypeORMDataSource } from 'typeorm';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';
import {
    DriverError,
    isDatabaseLockConflictError,
    withLockedEntity,
} from '../../../src';
import { LockItem } from '../../data/entity/lock-item';
import { LockOwner } from '../../data/entity/lock-owner';
import {
    createIntegrationDataSourceOptions,
    supportsRowLock,
    useIntegrationDriver,
} from '../../data/typeorm/integration';

const driver = useIntegrationDriver();

const updates : string[] = [];

@EventSubscriber()
class LockItemSubscriber implements EntitySubscriberInterface<LockItem> {
    listenTo() {
        return LockItem;
    }

    afterUpdate(event: UpdateEvent<LockItem>) {
        updates.push(event.entity?.status);
    }
}

function delay(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function capture(promise: Promise<unknown>) : Promise<unknown> {
    try {
        await promise;
    } catch (e) {
        return e;
    }

    throw new Error('The call was expected to fail.');
}

describe.runIf(supportsRowLock(driver))(`src/database/lock/entity (${driver})`, () => {
    let dataSource : DataSource;

    async function readStatus(id: number) : Promise<string | undefined> {
        const item = await dataSource.getRepository(LockItem).findOneBy({ id });
        return item?.status;
    }

    // Publish a draft: the guard only one of two concurrent callers may pass.
    function publish(hold?: Promise<void>, entered?: () => void) {
        return withLockedEntity(dataSource, LockItem, { id: 1 }, async (item, manager) => {
            entered?.();
            await hold;

            if (item.status !== 'draft') {
                return false;
            }

            item.status = 'published';
            await manager.save(item);

            return true;
        });
    }

    beforeAll(async () => {
        dataSource = new TypeORMDataSource(createIntegrationDataSourceOptions([LockItem, LockOwner], { subscribers: [LockItemSubscriber] }));
        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();
        try {
            await queryRunner.dropTable('lock_item', true);
            await queryRunner.dropTable('lock_owner', true);
        } finally {
            await queryRunner.release();
        }

        await dataSource.synchronize(false);
        await dataSource.getRepository(LockOwner).insert({ id: 1 });
    });

    beforeEach(async () => {
        updates.length = 0;
        await dataSource.getRepository(LockItem).clear();
        await dataSource.getRepository(LockItem).insert([
            {
                id: 1, 
                status: 'draft', 
                owner: { id: 1 }, 
            },
            {
                id: 2, 
                status: 'draft', 
                owner: null, 
            },
        ]);
    });

    afterAll(async () => {
        if (!dataSource || !dataSource.isInitialized) {
            return;
        }

        const queryRunner = dataSource.createQueryRunner();
        try {
            await queryRunner.dropTable('lock_item', true);
            await queryRunner.dropTable('lock_owner', true);
        } finally {
            await queryRunner.release();
        }

        await dataSource.destroy();
    });

    it('should let concurrent callers pass the guard one at a time', async () => {
        const hold = Promise.withResolvers<void>();
        const entered = Promise.withResolvers<void>();

        const first = publish(hold.promise, entered.resolve);
        await entered.promise;

        // the second caller has to wait for the first transaction to end,
        // and then sees the row as the first one left it.
        let entered2 = false;
        const second = publish(undefined, () => {
            entered2 = true;
        });
        try {
            await delay(500);
            // proof that its read waited, rather than ran before the first committed
            expect(entered2).toBe(false);
        } finally {
            hold.resolve();
        }

        expect(await Promise.all([first, second])).toEqual([true, false]);
        expect(await readStatus(1)).toEqual('published');
        expect(updates).toEqual(['published']);
    });

    it('should roll back if the callback throws', async () => {
        await expect(withLockedEntity(dataSource, LockItem, { id: 1 }, async (item, manager) => {
            item.status = 'published';
            await manager.save(item);

            throw new Error('boom');
        })).rejects.toThrow('boom');

        expect(await readStatus(1)).toEqual('draft');
    });

    it('should leave the row untouched if the callback declines', async () => {
        const output = await withLockedEntity(dataSource, LockItem, { id: 1 }, (item) => {
            // the eager relation is loaded, outside the locked query
            // (cockroachdb reads an int back as a string)
            expect(Number(item.owner?.id)).toBe(1);
            return item.status === 'published';
        });

        expect(output).toBe(false);
        expect(await readStatus(1)).toEqual('draft');
        expect(updates).toEqual([]);
    });

    it('should resolve null for a missing row', async () => {
        await expect(withLockedEntity(dataSource, LockItem, { id: 3 }, () => 'x')).resolves.toBeNull();
    });

    it('should lock a second row within the same transaction', async () => {
        await expect(withLockedEntity(dataSource, LockItem, { id: 1 }, async (item, manager) => {
            item.status = 'published';
            await manager.save(item);

            await withLockedEntity(manager, LockItem, { id: 2 }, async (inner, innerManager) => {
                expect(innerManager).toBe(manager);

                inner.status = 'published';
                await innerManager.save(inner);
            });

            if (driver !== 'mssql') {
                // the inner row stays locked until the outer transaction ends
                const error = await capture(withLockedEntity(dataSource, LockItem, { id: 2 }, () => 'x', { onLocked: 'nowait' }));
                expect(isDatabaseLockConflictError(error)).toBe(true);
            }

            throw new Error('boom');
        })).rejects.toThrow('boom');

        // one transaction: both writes are gone
        expect(await readStatus(1)).toEqual('draft');
        expect(await readStatus(2)).toEqual('draft');
    });

    it.runIf(driver !== 'mssql')('should fail fast on a locked row with nowait', async () => {
        const hold = Promise.withResolvers<void>();
        const entered = Promise.withResolvers<void>();

        const first = publish(hold.promise, entered.resolve);
        await entered.promise;

        try {
            const error = await capture(withLockedEntity(dataSource, LockItem, { id: 1 }, () => 'x', { onLocked: 'nowait' }));
            expect(isDatabaseLockConflictError(error)).toBe(true);
        } finally {
            hold.resolve();
        }

        expect(await first).toBe(true);
    });

    it.runIf(driver === 'mssql')('should refuse nowait', async () => {
        await expect(withLockedEntity(dataSource, LockItem, { id: 1 }, () => 'x', { onLocked: 'nowait' }))
            .rejects.toBeInstanceOf(DriverError);
    });
});

describe.runIf(driver && !supportsRowLock(driver))(`src/database/lock/entity (${driver})`, () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = new TypeORMDataSource(createIntegrationDataSourceOptions());
        await dataSource.initialize();
    });

    afterAll(async () => {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    it('should refuse to lock a row', async () => {
        await expect(withLockedEntity(dataSource, LockItem, { id: 1 }, () => 'x'))
            .rejects.toBeInstanceOf(DriverError);
    });
});
