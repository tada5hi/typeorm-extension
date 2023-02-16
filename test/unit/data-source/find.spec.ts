import {InstanceChecker} from "typeorm";
import {findDataSource} from "../../../src";
import path from "path";

describe('src/data-source/utils/find.ts', () => {
    it('should find data-source', async () => {
        let dataSource = await findDataSource({
            directory: path.join(__dirname, '..', '..', 'data', 'typeorm')
        });

        expect(dataSource).toBeDefined();
        expect(InstanceChecker.isDataSource(dataSource));
        if(dataSource) {
            expect(dataSource.options.extra).toBeDefined();
        }

        dataSource = await findDataSource({
            directory: 'test/data/typeorm'
        })

        expect(dataSource).toBeDefined();
        expect(InstanceChecker.isDataSource(dataSource));
    });

    it('should find data-source with windows separator', async () => {
        const dataSource = await findDataSource({
            directory: 'test\\data\\typeorm'
        })

        expect(dataSource).toBeDefined();
        expect(InstanceChecker.isDataSource(dataSource));
    })

    it('should find data-source with default export', async () => {
        let dataSource = await findDataSource({
            fileName: 'data-source-default',
            directory: path.join(__dirname, '..', '..', 'data', 'typeorm')
        });

        expect(dataSource).toBeDefined();
        expect(InstanceChecker.isDataSource(dataSource));
        if(dataSource) {
            expect(dataSource.options.extra).toBeUndefined();
        }

        dataSource = await findDataSource({
            fileName: 'data-source-default',
            directory: 'test/data/typeorm'
        })

        expect(dataSource).toBeDefined();
        expect(InstanceChecker.isDataSource(dataSource));
    })
})
