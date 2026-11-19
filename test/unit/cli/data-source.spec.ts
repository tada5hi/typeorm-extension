import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCLIDataSourceContext } from '../../../src/cli/data-source';
import { buildDataSourceOptions } from '../../../src';

const root = path.join(import.meta.dirname, '..', '..', 'data', 'source-only');

describe('src/cli/data-source', () => {
    it('should find a data source given without extension below src, when there is no build', async () => {
        const { context } = await buildCLIDataSourceContext({ dataSource: 'src/config/orm', root });

        const options = await buildDataSourceOptions(context);

        expect(options.extra).toEqual({ sourceOnly: 'orm' });
    });

    it('should find a data source given with extension below src, when there is no build', async () => {
        const { context } = await buildCLIDataSourceContext({ dataSource: 'src/data-source.ts', root });

        const options = await buildDataSourceOptions(context);

        expect(options.extra).toEqual({ sourceOnly: true });
    });

    it('should keep the given path in preserve mode', async () => {
        const { context } = await buildCLIDataSourceContext({
            dataSource: 'src/config/orm',
            root,
            preserveFilePaths: true,
        });

        expect(context.directory).toEqual(path.join(root, 'src', 'config'));
        expect(context.dataSourceName).toEqual('orm');
    });
});
