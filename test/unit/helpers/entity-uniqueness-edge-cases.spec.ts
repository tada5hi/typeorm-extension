import {
    Column,
    DataSource,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { describe, expect, it } from 'vitest';
import { isEntityUnique } from '../../../src';
import { Account } from '../../data/entity/account';
import { Person } from '../../data/entity/person';
import { Role } from '../../data/entity/role';
import { createDataSource } from '../../data/typeorm/factory';

@Entity({ name: 'indexed_records' })
@Index(['label'], { unique: true })
class IndexedRecord {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar' })
    label: string;
}

describe('entity-uniqueness-edge-cases', () => {
    it('should detect a conflict on a column of an embedded entity', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        try {
            const repository = dataSource.getRepository(Person);
            await repository.save(repository.create({ profile: { email: 'taken@example.com', nickname: null } }));

            // The property path of an embedded column is nested and differs
            // from its property name.
            const conflicting = await isEntityUnique({
                dataSource,
                entityTarget: Person,
                entity: { profile: { email: 'taken@example.com', nickname: null } },
            });
            expect(conflicting).toBeFalsy();

            const free = await isEntityUnique({
                dataSource,
                entityTarget: Person,
                entity: { profile: { email: 'free@example.com', nickname: null } },
            });
            expect(free).toBeTruthy();
        } finally {
            await dataSource.destroy();
        }
    });

    it('should fall back to unique indices when no unique constraint is declared', async () => {
        const dataSource = new DataSource({
            type: 'better-sqlite3',
            database: ':memory:',
            entities: [IndexedRecord],
            synchronize: true,
        });
        await dataSource.initialize();

        try {
            const repository = dataSource.getRepository(IndexedRecord);
            await repository.save(repository.create({ label: 'taken' }));

            const conflicting = await isEntityUnique({
                dataSource,
                entityTarget: IndexedRecord,
                entity: { label: 'taken' },
            });
            expect(conflicting).toBeFalsy();

            const free = await isEntityUnique({
                dataSource,
                entityTarget: IndexedRecord,
                entity: { label: 'free' },
            });
            expect(free).toBeTruthy();
        } finally {
            await dataSource.destroy();
        }
    });

    it('should report an entity without unique columns as unique', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        try {
            const repository = dataSource.getRepository(Role);
            await repository.save(repository.create({ name: 'admin' }));

            // Role declares neither a unique constraint nor a unique index,
            // so there is nothing which could conflict.
            const unique = await isEntityUnique({
                dataSource,
                entityTarget: Role,
                entity: { name: 'admin' },
            });
            expect(unique).toBeTruthy();
        } finally {
            await dataSource.destroy();
        }
    });

    it('should treat a column absent from an insert as null', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        try {
            const repository = dataSource.getRepository(Account);
            await repository.save(repository.create({ userName: 'admin', tenantId: null }));

            // No existing entity, so tenantId is what an insert would store.
            const conflicting = await isEntityUnique({
                dataSource,
                entityTarget: Account,
                entity: { userName: 'admin' },
            });
            expect(conflicting).toBeFalsy();
        } finally {
            await dataSource.destroy();
        }
    });

    it('should not report a conflict with the entity being updated itself', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        try {
            const repository = dataSource.getRepository(Account);
            const account = await repository.save(repository.create({
                userName: 'admin',
                tenantId: 1,
            }));

            const unique = await isEntityUnique({
                dataSource,
                entityTarget: Account,
                entity: { userName: 'admin', tenantId: 1 },
                entityExisting: account,
            });
            expect(unique).toBeTruthy();
        } finally {
            await dataSource.destroy();
        }
    });
});
