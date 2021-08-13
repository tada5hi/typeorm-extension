import {applyPagination, applyRequestPagination, transformPagination} from "../../../src";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";

describe('src/api/pagination.ts', () => {
    it('should transform pagination', () => {
        let pagination = transformPagination(undefined, {maxLimit: 50});
        expect(pagination).toEqual({offset: 0, limit: 50});

        pagination = transformPagination(undefined, undefined);
        expect(pagination).toEqual({});

        pagination = transformPagination( {limit: 100}, {maxLimit: 50});
        expect(pagination).toEqual({offset: 0, limit: 50});

        pagination = transformPagination( {limit: 50}, {maxLimit: 50});
        expect(pagination).toEqual({offset: 0, limit: 50});

        pagination = transformPagination( {offset: 20, limit: 20}, {maxLimit: 50});
        expect(pagination).toEqual({offset: 20, limit: 20});
    });

    it('should apply pagination', () => {
        const query = new FakeSelectQueryBuilder();
        let appliedPagination = applyPagination(query, undefined, {maxLimit: 50});
        expect(appliedPagination).toEqual({offset: 0, limit: 50});

        // backward compatibility
        appliedPagination = applyRequestPagination(query, undefined, 50);
        expect(appliedPagination).toEqual({offset: 0, limit: 50});
    });
});
