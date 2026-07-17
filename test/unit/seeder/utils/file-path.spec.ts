import path from 'node:path';
import { buildFilePathname, resolveFilePaths } from '../../../../src';

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

    describe('buildFilePathname', () => {
        it('should build file path name', () => {
            const files = [
                {
                    directory: '/path/to/dir',
                    path: '/path/to/dir/2_file.ts',
                    name: '2_file',
                    extension: '.ts',
                },
                {
                    directory: '/path/to/dir',
                    path: '/path/to/dir/1_file.ts',
                    name: '1_file',
                    extension: '.ts',
                },
                {
                    directory: '/path/to/dir',
                    path: '/path/to/dir/0_file.ts',
                    name: '0_file',
                    extension: '.ts',
                },
            ];
            const result = buildFilePathname(files);
            expect(result).toEqual([
                path.join(path.sep, 'path', 'to', 'dir', '0_file.ts'),
                path.join(path.sep, 'path', 'to', 'dir', '1_file.ts'),
                path.join(path.sep, 'path', 'to', 'dir', '2_file.ts'),
            ]);
        });
    });
});
