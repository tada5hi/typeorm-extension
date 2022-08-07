import {parseQuerySort} from "rapiq";
import {applyQuerySort, applyQuerySortParseOutput, applySort} from "../../../src";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";

describe('src/api/sort.ts', () => {
    const query = new FakeSelectQueryBuilder();
    it('should apply sort transformed', () => {
        let data = applyQuerySortParseOutput(query, parseQuerySort('id', {allowed: ['id']}));
        expect(data).toBeDefined();

        data = applyQuerySortParseOutput(query, []);
        expect(data).toEqual([]);
    });

    it('should apply sort', () => {
        let applied = applyQuerySort(query,'id', {allowed: ['id']});
        expect(applied).toBeDefined();

        applied = applySort(query,'id', {allowed: ['id']});
        expect(applied).toBeDefined();
    });
});
