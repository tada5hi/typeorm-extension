import {ParseOutput} from "rapiq";
import {applyQuery, applyQueryParseOutput, QueryFieldsApplyOutput} from "../../../src";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";

describe('src/api/sort.ts', () => {
    const query = new FakeSelectQueryBuilder();

    it('should apply query', () => {
        let data = applyQuery(
            query,
            {
                fields: ['id', 'name', 'fake']
            },
            {
                defaultAlias: 'user',
                fields: {
                    allowed: ['id', 'name']
                }
            }
        );

        expect(data.fields).toEqual([
            {key: 'id', path: 'user'},
            {key: 'name', path: 'user'},
        ] as QueryFieldsApplyOutput);
    })

    it('should apply query parse output', () => {
        let data = applyQueryParseOutput(query, {
            relations: [],
            fields: [],
            filters: [],
            pagination: {},
            sort: []
        });
        expect(data).toEqual({
            relations: [],
            fields: [],
            filters: [],
            pagination: {},
            sort: []
        } as ParseOutput);

        data = applyQueryParseOutput(query, {
            defaultPath: 'user',
            relations: [],
            fields: [],
            filters: [],
            pagination: {},
            sort: []
        });
        expect(data).toEqual({
            defaultPath: 'user',
            relations: [],
            fields: [],
            filters: [],
            pagination: {},
            sort: []
        } as ParseOutput);
    });
});
