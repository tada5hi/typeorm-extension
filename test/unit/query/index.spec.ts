import {ParseOutput} from "rapiq";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";
import {applyQueryParseOutput} from "../../../src";

describe('src/api/sort.ts', () => {
    const query = new FakeSelectQueryBuilder();

    it('should apply query output', () => {
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
