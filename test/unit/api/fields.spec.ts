import {
    applyQueryFields,
} from "../../../src";

import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";

describe('src/api/fields.ts', () => {
    it('should apply query fields', () => {
        const queryBuilder = new FakeSelectQueryBuilder();

        const value = applyQueryFields(queryBuilder, [], {});
        expect(value).toBeDefined();
        expect(value).toEqual([]);
    });
});
