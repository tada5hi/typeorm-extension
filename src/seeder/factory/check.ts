import { hasInstanceof } from '@ebec/core';
import { SEEDER_FACTORY_INSTANCE } from './constants';
import type { ISeederFactory } from './types';

/**
 * Check whether the input is a seeder factory. The check reads a
 * Symbol.for() marker instead of using instanceof, so a factory created
 * by another copy of the library (e.g. a duplicate install) still counts.
 */
export function isSeederFactory(input: unknown) : input is ISeederFactory<any, any> {
    return hasInstanceof(input, SEEDER_FACTORY_INSTANCE);
}
