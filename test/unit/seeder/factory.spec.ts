import {
    afterEach, beforeEach, describe, expect, it,
} from 'vitest';
import type { DataSource } from 'typeorm';
import { useSeederFactory } from '../../../src';
import { User } from '../../data/entity/user';
import { destroyTestFsDataSource, setupFsDataSource } from '../../data/typeorm/utils';
import '../../data/factory/user';

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

        for (let i = 0; i < users.length; i++) {
            expect(users[i].id).toBeDefined();
        }
    });

    it('should create with different locales', async () => {
        const factory = useSeederFactory(User);
        let user = await factory.save();
        expect(user).toBeDefined();

        factory.setLocale('de');
        user = await factory.save();
        expect(user).toBeDefined();
    });
});
