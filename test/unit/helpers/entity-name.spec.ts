import { EntitySchema } from 'typeorm';
import { getEntityName } from '../../../src';

describe('src/helpers/entity/name.ts', () => {
    it('should resolve the name of a class', () => {
        class User {}

        expect(getEntityName(User)).toEqual('User');
    });

    it('should resolve the name of an entity schema', () => {
        const schema = new EntitySchema({ name: 'user', columns: {} });

        expect(getEntityName(schema)).toEqual('user');
    });
});
