import {
    describe, expect, it,
} from 'vitest';
import { applyPagination, applyQueryPagination } from '../../../src';
import { FakeSelectQueryBuilder } from '../../data/typeorm/FakeSelectQueryBuilder';

describe('src/api/pagination.ts', () => {
    it('should apply pagination', () => {
        const query = new FakeSelectQueryBuilder();
        let value = applyQueryPagination(query, undefined, { maxLimit: 50 });
        expect(value).toEqual({ offset: 0, limit: 50 });

        value = applyPagination(query, undefined, { maxLimit: 50 });
        expect(value).toEqual({ offset: 0, limit: 50 });
    });
});
