import {findDataSource} from "../../../src";
import path from "path";

describe('src/data-source/utils/find.ts', () => {
    it('should find data-source', async () => {
        const dataSource = await findDataSource({
            directory: path.join(__dirname, '..', '..', 'data', 'typeorm')
        });

        expect(dataSource).toBeDefined();
        if(dataSource) {
            expect(dataSource.options).toBeDefined();
        }
    })

    it('should find data-source with default export', async () => {
        const dataSource = await findDataSource({
            fileName: 'data-source-default',
            directory: path.join(__dirname, '..', '..', 'data', 'typeorm')
        });

        expect(dataSource).toBeDefined();
        if(dataSource) {
            expect(dataSource.options).toBeDefined();
        }
    })
})
