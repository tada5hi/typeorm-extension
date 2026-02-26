import {
    describe, expect, it,
} from 'vitest';
import { getEntityPropertyNames } from '../../../src';
import { User } from '../../data/entity/user';
import { createDataSource } from '../../data/typeorm/factory';

describe('entity-property-names', () => {
    it('should get entity property names by entity target', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const propertyNames = await getEntityPropertyNames(User, dataSource);
        expect(propertyNames.length).toBeGreaterThan(0);
        expect(propertyNames).toEqual([
            'id',
            'firstName',
            'lastName',
            'email',
            'roleId',
            'role',
        ]);

        await dataSource.destroy();
    });

    it('should get entity property names by repository', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();
        await dataSource.synchronize();

        const repository = dataSource.getRepository(User);
        const propertyNames = await getEntityPropertyNames(repository, dataSource);
        expect(propertyNames.length).toBeGreaterThan(0);
        expect(propertyNames).toEqual([
            'id',
            'firstName',
            'lastName',
            'email',
            'roleId',
            'role',
        ]);

        await dataSource.destroy();
    });
});
