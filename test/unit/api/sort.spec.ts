import {parseSort} from "@trapi/query";
import {applyQuerySort, applyParsedQuerySort} from "../../../src";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";

describe('src/api/sort.ts', () => {

    it('should apply sort transformed', () => {
        const query = new FakeSelectQueryBuilder();
        const applied = applyParsedQuerySort(query, parseSort('id', {allowed: ['id']}));
        expect(applied).toBeDefined();
    });

    it('should apply sort', () => {
        const query = new FakeSelectQueryBuilder();
        const applied = applyQuerySort(query,'id', {allowed: ['id']});
        expect(applied).toBeDefined();
    });
});
