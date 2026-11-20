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
import { IndexedKeyedRecord } from '../../data/entity/indexed-keyed-record';
import { KeyedRecord } from '../../data/entity/keyed-record';
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

    it('should not report a conflict for a unique column which is null', async () => {
        const dataSource = new DataSource({
            type: 'better-sqlite3',
            database: ':memory:',
            entities: [KeyedRecord],
            synchronize: true,
        });

        await dataSource.initialize();

        try {
            const repository = dataSource.getRepository(KeyedRecord);

            await repository.save(repository.create({ externalKey: null }));
            await repository.save(repository.create({ externalKey: 'taken' }));

            // A group whose every member is null identifies no row, so the
            // database accepts any number of them.
            const nullKey = await isEntityUnique({
                dataSource,
                entityTarget: KeyedRecord,
                entity: { externalKey: null },
            });

            expect(nullKey).toBeTruthy();

            const absentKey = await isEntityUnique({
                dataSource,
                entityTarget: KeyedRecord,
                entity: {},
            });

            expect(absentKey).toBeTruthy();

            const takenKey = await isEntityUnique({
                dataSource,
                entityTarget: KeyedRecord,
                entity: { externalKey: 'taken' },
            });

            expect(takenKey).toBeFalsy();
        } finally {
            await dataSource.destroy();
        }
    });

    it('should not report a conflict for a unique index column which is null', async () => {
        const dataSource = new DataSource({
            type: 'better-sqlite3',
            database: ':memory:',
            entities: [IndexedKeyedRecord],
            synchronize: true,
        });

        await dataSource.initialize();

        try {
            const repository = dataSource.getRepository(IndexedKeyedRecord);

            await repository.save(repository.create({ externalKey: null }));

            const unique = await isEntityUnique({
                dataSource,
                entityTarget: IndexedKeyedRecord,
                entity: { externalKey: null },
            });

            expect(unique).toBeTruthy();
        } finally {
            await dataSource.destroy();
        }
    });

    it('should keep a persisted null of a partial update out of the check', async () => {
        const dataSource = new DataSource({
            type: 'better-sqlite3',
            database: ':memory:',
            entities: [KeyedRecord],
            synchronize: true,
        });

        await dataSource.initialize();

        try {
            const repository = dataSource.getRepository(KeyedRecord);

            await repository.save(repository.create({ externalKey: null }));

            const updated = await repository.save(repository.create({ externalKey: null }));

            const unique = await isEntityUnique({
                dataSource,
                entityTarget: KeyedRecord,
                entity: {},
                entityExisting: updated,
            });

            expect(unique).toBeTruthy();
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
