import {
    describe, expect, it,
} from 'vitest';
import type { ParseOutput } from 'rapiq';
import type { QueryFieldsApplyOutput } from '../../../src';
import { applyQuery, applyQueryParseOutput } from '../../../src';
import { FakeSelectQueryBuilder } from '../../data/typeorm/FakeSelectQueryBuilder';

describe('src/api/sort.ts', () => {
    const query = new FakeSelectQueryBuilder();

    it('should apply query', () => {
        const data = applyQuery(
            query,
            {
                fields: ['id', 'name', 'fake'],
            },
            {
                defaultAlias: 'user',
                fields: {
                    allowed: ['id', 'name'],
                },
            },
        );

        expect(data.fields).toEqual([
            { key: 'id', path: 'user' },
            { key: 'name', path: 'user' },
        ] as QueryFieldsApplyOutput);
    });

    it('should apply query with empty parse output and options', () => {
        const data = applyQuery(query, { }, {
            pagination: {
                maxLimit: 50,
            },
        });

        expect(data.pagination).toEqual({ limit: 50, offset: 0 });
    });

    it('should apply query with empty parse output', () => {
        let data = applyQueryParseOutput(query, {
            relations: [],
            fields: [],
            filters: [],
            pagination: {},
            sort: [],
        });
        expect(data).toEqual({
            relations: [],
            fields: [],
            filters: [],
            pagination: {},
            sort: [],
        } as ParseOutput);

        data = applyQueryParseOutput(query, {
            defaultPath: 'user',
            relations: [],
            fields: [],
            filters: [],
            pagination: {},
            sort: [],
        });
        expect(data).toEqual({
            defaultPath: 'user',
            relations: [],
            fields: [],
            filters: [],
            pagination: {},
            sort: [],
        } as ParseOutput);
    });
});
