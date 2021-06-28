import {applyRequestFilter, applyRequestFilters} from "../../../src";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";
import {QueryStatement, transformRequestFilters} from "../../../src/api/filters";

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


        let queryStatements = applyRequestFilters(queryBuilder, {id: 1}, ['id']);
        expect(queryStatements).toEqual([
            {type: 'where', query: 'id = :filter-id-1', bindings: {'filter-id-1': 1}}
        ] as QueryStatement[]);

        queryStatements = applyRequestFilters(queryBuilder, {idAlias: 1}, {idAlias: 'id'});
        expect(queryStatements).toEqual([
            {type: 'where', query: 'id = :filter-id-1', bindings: {'filter-id-1': 1}}
        ] as QueryStatement[]);

        // equal operator
        queryStatements = applyRequestFilters(queryBuilder, {id: '1'}, ['id']);
        expect(queryStatements).toEqual([
            {type: 'where', query: 'id = :filter-id-1', bindings: {'filter-id-1': '1'}}
        ] as QueryStatement[]);

        // negation with equal operator
        queryStatements = applyRequestFilters(queryBuilder, {id: '!1'}, ['id']);
        expect(queryStatements).toEqual([
            {type: 'where', query: 'id != :filter-id-1', bindings: {'filter-id-1': '1'}}
        ] as QueryStatement[]);

        // in operator
        queryStatements = applyRequestFilters(queryBuilder, {id: '1,2,3'}, ['id']);
        expect(queryStatements).toEqual([
            {type: 'where', query: 'id IN (:...filter-id-1)', bindings: {'filter-id-1': ["1","2","3"]}}
        ] as QueryStatement[]);

        // negation with in operator
        queryStatements = applyRequestFilters(queryBuilder, {id: '!1,2,3'}, ['id']);
        expect(queryStatements).toEqual([
            {type: 'where', query: 'id NOT IN (:...filter-id-1)', bindings: {'filter-id-1': ["1","2","3"]}}
        ] as QueryStatement[]);

        // like operator
        queryStatements = applyRequestFilters(queryBuilder, {name: '~name'}, ['name']);
        expect(queryStatements).toEqual([
            {type: 'where', query: 'name LIKE :filter-name-1', bindings: {'filter-name-1': 'name%'}}
        ] as QueryStatement[]);

        // negation with like operator
        queryStatements = applyRequestFilters(queryBuilder, {name: '!~name'}, ['name']);
        expect(queryStatements).toEqual([
            {type: 'where', query: 'name NOT LIKE :filter-name-1', bindings: {'filter-name-1': 'name%'}}
        ] as QueryStatement[]);

        // check alias function
        queryStatements = applyRequestFilter(queryBuilder, {id: 1}, ['id']);
        expect(queryStatements).toEqual([
            {type: 'where', query: 'id = :filter-id-1', bindings: {'filter-id-1': 1}}
        ] as QueryStatement[]);

        queryStatements = applyRequestFilter(queryBuilder, {}, {name: 'name'});
        expect(queryStatements).toEqual([] as QueryStatement[]);
    });
});
