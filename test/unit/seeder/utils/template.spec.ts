import { buildSeederFileTemplate } from '../../../../src';

describe('src/seeder/utils/template.ts', () => {
    describe('buildSeederFileTemplate', () => {
        it('should build a seeder class template', () => {
            const template = buildSeederFileTemplate('foo-bar', 1700000000000);

            expect(template).toContain('export class FooBar1700000000000 implements Seeder');
            expect(template).toContain('track = false;');
        });
    });
});
