import { EntitySchema } from 'typeorm';
import { describe, expect, it } from 'vitest';
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

    it('should keep a name which is already given as a string', () => {
        expect(getEntityName('User')).toEqual('User');
    });
});
