import {
    applyFields,
    applyQueryFields,
} from "../../../src";

import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";

describe('src/api/fields.ts', () => {
    it('should apply query fields', () => {
        const queryBuilder = new FakeSelectQueryBuilder();

        let value = applyQueryFields(queryBuilder, [], {});
        expect(value).toBeDefined();
        expect(value).toEqual([]);

        value = applyFields(queryBuilder, [], {});
        expect(value).toBeDefined();
        expect(value).toEqual([]);
    });
});
