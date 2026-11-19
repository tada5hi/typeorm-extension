import { markInstanceof } from '@ebec/core';
import { describe, expect, it } from 'vitest';
import {
    SEEDER_FACTORY_INSTANCE,
    SeederFactory,
    isSeederFactory,
} from '../../../src';
import { User } from '../../data/entity/user';

describe('src/seeder/factory/check.ts', () => {
    const create = () => new SeederFactory<User>({
        name: 'user',
        entity: User,
        factoryFn: () => new User(),
    });

    it('should recognize a factory instance', () => {
        expect(isSeederFactory(create())).toBe(true);
    });

    it('should keep the marker out of the own enumerable keys', () => {
        expect(Object.keys(create())).not.toContain('@instanceof');
    });

    it('should recognize a factory of another library copy by its marker', () => {
        const foreign = {};

        markInstanceof(foreign, Symbol.for('typeorm-extension/SeederFactory'));

        expect(SEEDER_FACTORY_INSTANCE).toBe(Symbol.for('typeorm-extension/SeederFactory'));
        expect(isSeederFactory(foreign)).toBe(true);
    });

    it('should not match look-alikes or primitives', () => {
        expect(isSeederFactory({ make: () => ({}), save: () => ({}) })).toBe(false);
        expect(isSeederFactory(null)).toBe(false);
        expect(isSeederFactory(undefined)).toBe(false);
        expect(isSeederFactory('factory')).toBe(false);
    });
});
