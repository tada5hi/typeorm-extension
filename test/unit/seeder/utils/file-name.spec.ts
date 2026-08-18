import { describe, expect, it } from 'vitest';
import { buildSeederFileName } from '../../../../src';

describe('src/seeder/utils/file-name.ts', () => {
    it('should derive a typescript file name by default', () => {
        expect(buildSeederFileName('user', 1234)).toEqual('1234-user.ts');
    });

    it('should derive a javascript file name', () => {
        expect(buildSeederFileName('user', 1234, { javascript: true })).toEqual('1234-user.js');
    });

    it('should keep an existing extension', () => {
        expect(buildSeederFileName('user.mts', 1234)).toEqual('1234-user.mts');
        expect(buildSeederFileName('user.js', 1234, { javascript: false })).toEqual('1234-user.js');
    });
});
