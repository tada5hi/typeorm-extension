import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveFilePaths, resolveFilePatterns } from '../../../../src';

describe('src/seeder/utils/file-path.ts', () => {
    describe('resolveFilePaths', () => {
        it('should keep absolute paths untouched', () => {
            const input = path.join(path.sep, 'path', 'to', 'file.ts');

            expect(resolveFilePaths([input])).toEqual([input]);
        });

        it('should resolve relative paths against the root', () => {
            expect(resolveFilePaths(['file.ts'], path.join(path.sep, 'root'))).toEqual([
                path.join(path.sep, 'root', 'file.ts'),
            ]);
        });

        it('should resolve relative paths against the working directory', () => {
            expect(resolveFilePaths(['file.ts'])).toEqual([
                path.resolve(process.cwd(), 'file.ts'),
            ]);
        });
    });

    describe('resolveFilePatterns', () => {
        it('should glob patterns and order matches by file name', async () => {
            const result = await resolveFilePatterns(['test/data/seed/*.{ts,js}']);

            expect(result.length).toBeGreaterThanOrEqual(2);

            const names = result.map((el) => path.basename(el));
            expect(names).toEqual([...names].sort());
        });
    });
});
