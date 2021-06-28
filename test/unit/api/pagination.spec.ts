import {applyRequestPagination} from "../../../src";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";

describe('src/api/pagination.ts', () => {
    it('should apply request pagination', () => {
        const query = new FakeSelectQueryBuilder();
        let appliedPagination = applyRequestPagination(query, undefined, 50);
        expect(appliedPagination).toEqual({offset: 0, limit: 50});

        appliedPagination = applyRequestPagination(query, undefined, undefined);
        expect(appliedPagination).toEqual({});

        appliedPagination = applyRequestPagination(query, {limit: 100}, 50);
        expect(appliedPagination).toEqual({offset: 0, limit: 50});

        appliedPagination = applyRequestPagination(query, {limit: 50}, 50);
        expect(appliedPagination).toEqual({offset: 0, limit: 50});

        appliedPagination = applyRequestPagination(query, {offset: 20, limit: 20}, 50);
        expect(appliedPagination).toEqual({offset: 20, limit: 20});
    })
});
