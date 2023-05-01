import path from "node:path";
import { buildFilePathname } from '../../../../src';

describe('src/seeder/utils/file-path.ts', function () {
    describe('buildFilePathname', function () {
        it('should build file path name', function () {
            const files = [
                {
                    path: '/path/to/dir',
                    name: '2_file',
                    extension: '.ts',
                },
                {
                    path: '/path/to/dir',
                    name: '1_file',
                    extension: '.ts',
                },
                {
                    path: '/path/to/dir',
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
