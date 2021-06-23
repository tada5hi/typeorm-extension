import {applyRequestFilter, applyRequestFilters} from "../../../src";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";
import {transformRequestFilters} from "../../../src/api/filters";

describe('src/api/filters.ts', () => {
    it('should transform request filters', () => {
        let allowedFilters = transformRequestFilters({id: 1}, {id: 'id'});
        expect(allowedFilters).toEqual({id: 1});

        allowedFilters = transformRequestFilters({aliasId: 1}, {aliasId: 'id'});
        expect(allowedFilters).toEqual({id: 1});

        allowedFilters = transformRequestFilters({name: 'tada5hi'}, {name: 'name'});
        expect(allowedFilters).toEqual({name: 'tada5hi'});

        allowedFilters = transformRequestFilters({name: ''}, {name: 'name'});
        expect(allowedFilters).toEqual({});

        allowedFilters = transformRequestFilters({name: null}, {name: 'name'});
        expect(allowedFilters).toEqual({});

        allowedFilters = transformRequestFilters({id: 1}, {name: 'name'});
        expect(allowedFilters).toEqual({});

        allowedFilters = transformRequestFilters({}, {name: 'name'});
        expect(allowedFilters).toEqual({});
    })

    it('should apply request filters', () => {
        const queryBuilder = new FakeSelectQueryBuilder();

        let appliedRequestFilters = applyRequestFilters(queryBuilder, {id: 1}, ['id']);
        expect(appliedRequestFilters).toEqual({id: 1});

        appliedRequestFilters = applyRequestFilters(queryBuilder, {idAlias: 1}, {idAlias: 'id'});
        expect(appliedRequestFilters).toEqual({id: 1});

        // check alias function
        appliedRequestFilters = applyRequestFilter(queryBuilder, {id: 1}, ['id']);
        expect(appliedRequestFilters).toEqual({id: 1});

        appliedRequestFilters = applyRequestFilter(queryBuilder, {}, {name: 'name'});
        expect(appliedRequestFilters).toEqual({});
    });
});
