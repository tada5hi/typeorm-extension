import path from 'node:path';
import { buildFilePathname } from '../../../../src';

describe('src/seeder/utils/file-path.ts', () => {
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
