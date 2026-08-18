import { describe, expect, it } from 'vitest';
import { isDirectory } from '../../../src';

describe('src/utils/file-system.ts', () => {
    it('should detect a directory', async () => {
        expect(await isDirectory('test/data')).toBeTruthy();
    });

    it('should reject a file', async () => {
        expect(await isDirectory('test/data/tsconfig.json')).toBeFalsy();
    });

    it('should reject a non-existing path', async () => {
        expect(await isDirectory('test/data/non-existing')).toBeFalsy();
    });
});
