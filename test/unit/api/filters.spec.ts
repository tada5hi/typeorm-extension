import {applyRequestFilter, applyRequestFilters} from "../../../src";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";
import {applyFilters, FiltersTransformed, transformFilters} from "../../../src/api/filters";

describe('src/api/filters.ts', () => {
    it('should transform request filters', () => {
        // filter id
        let allowedFilters = transformFilters({id: 1});
        expect(allowedFilters).toEqual([{type: 'where', query: 'id = :filter_id_1', bindings: {'filter_id_1': 1}}]  as FiltersTransformed);

        // filter none
        allowedFilters = transformFilters({id: 1}, {allowed: []});
        expect(allowedFilters).toEqual([]  as FiltersTransformed);

        // filter with alias
        allowedFilters = transformFilters({aliasId: 1}, {aliasMapping: {aliasId: 'id'}, allowed: ['id']});
        expect(allowedFilters).toEqual([{type: 'where', query: 'id = :filter_id_1', bindings: {'filter_id_1': 1}}] as FiltersTransformed);

        // filter allowed
        allowedFilters = transformFilters({name: 'tada5hi'}, {allowed: ['name']});
        expect(allowedFilters).toEqual( [{type: 'where', query: 'name = :filter_name_1', bindings: {'filter_name_1': 'tada5hi'}}] as FiltersTransformed);

        // filter data with el empty value
        allowedFilters = transformFilters({name: ''}, {allowed: ['name']});
        expect(allowedFilters).toEqual([] as FiltersTransformed);

        // filter data with el null value
        allowedFilters = transformFilters({name: null}, {allowed: ['name']});
        expect(allowedFilters).toEqual([] as FiltersTransformed);

        // filter wrong allowed
        allowedFilters = transformFilters({id: 1}, {allowed: ['name']});
        expect(allowedFilters).toEqual([] as FiltersTransformed);

        // filter empty data
        allowedFilters = transformFilters({}, {allowed: ['name']});
        expect(allowedFilters).toEqual([] as FiltersTransformed);
    });

    it('should transform request filters with different operators', () => {
        // equal operator
        let data = transformFilters({id: '1'}, {allowed: ['id']});
        expect(data).toEqual([
            {type: 'where', query: 'id = :filter_id_1', bindings: {'filter_id_1': '1'}}
        ] as FiltersTransformed);

        // negation with equal operator
        data = transformFilters({id: '!1'}, {allowed: ['id']});
        expect(data).toEqual([
            {type: 'where', query: 'id != :filter_id_1', bindings: {'filter_id_1': '1'}}
        ] as FiltersTransformed);

        // in operator
        data = transformFilters({id: '1,2,3'}, {allowed: ['id']});
        expect(data).toEqual([
            {type: 'where', query: 'id IN (:...filter_id_1)', bindings: {'filter_id_1': ["1","2","3"]}}
        ] as FiltersTransformed);

        // negation with in operator
        data = transformFilters({id: '!1,2,3'}, {allowed: ['id']});
        expect(data).toEqual([
            {type: 'where', query: 'id NOT IN (:...filter_id_1)', bindings: {'filter_id_1': ["1","2","3"]}}
        ] as FiltersTransformed);

        // like operator
        data = transformFilters({name: '~name'}, {allowed: ['name']});
        expect(data).toEqual([
            {type: 'where', query: 'name LIKE :filter_name_1', bindings: {'filter_name_1': 'name%'}}
        ] as FiltersTransformed);

        // negation with like operator
        data = transformFilters({name: '!~name'}, {allowed: ['name']});
        expect(data).toEqual([
            {type: 'where', query: 'name NOT LIKE :filter_name_1', bindings: {'filter_name_1': 'name%'}}
        ] as FiltersTransformed);
    });

    it('should apply request filters', () => {
        const queryBuilder = new FakeSelectQueryBuilder();

        let data = applyFilters(queryBuilder, {id: 1}, {allowed: ['id']});
        expect(data).toEqual([
            {type: 'where', query: 'id = :filter_id_1', bindings: {'filter_id_1': 1}}
        ] as FiltersTransformed);

        // backward test
        data = applyRequestFilters(queryBuilder, {id: 1}, {id: 'id'}, {allowed: ['id']});
        expect(data).toEqual([
            {type: 'where', query: 'id = :filter_id_1', bindings: {'filter_id_1': 1}}
        ] as FiltersTransformed);

        data = applyRequestFilter(queryBuilder, {id: 1}, {id: 'id'}, {allowed: ['id']});
        expect(data).toEqual([
            {type: 'where', query: 'id = :filter_id_1', bindings: {'filter_id_1': 1}}
        ] as FiltersTransformed);
    });
});
