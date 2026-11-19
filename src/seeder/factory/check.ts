import { hasInstanceof } from '@ebec/core';
import { isObject } from '../../utils';
import { SEEDER_FACTORY_INSTANCE } from './constants';
import type { ISeederFactory } from './types';

const SEEDER_FACTORY_METHODS = ['setMeta', 'make', 'save', 'saveMany'] as const;

/**
 * Check whether the input is a seeder factory.
 *
 * The check reads a Symbol.for() class marker instead of using instanceof,
 * so a factory created by another copy of the library (e.g. a duplicate
 * install) still counts. An unmarked object (a copy from before the marker
 * existed) counts when it has the context and every public method.
 */
export function isSeederFactory(input: unknown) : input is ISeederFactory<any, any> {
    if (hasInstanceof(input, SEEDER_FACTORY_INSTANCE)) {
        return true;
    }

    if (!isObject(input) || !isObject(input.context)) {
        return false;
    }

    return SEEDER_FACTORY_METHODS.every((key) => typeof input[key] === 'function');
}
