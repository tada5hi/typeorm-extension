import {applyRequestFilter, applyRequestFilters, transformIncludes} from "../../../src";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";
import {applyFilters, FiltersOptions, FiltersTransformed, transformFilters} from "../../../src/api/filters";

describe('src/api/filters.ts', () => {
    it('should transform request filters', () => {
        // filter id
        let allowedFilters = transformFilters({id: 1});
        expect(allowedFilters).toEqual([{type: 'where', query: 'id = :filter_id', bindings: {'filter_id': 1}}]  as FiltersTransformed);

        // filter none
        allowedFilters = transformFilters({id: 1}, {allowed: []});
        expect(allowedFilters).toEqual([]  as FiltersTransformed);

        // filter with alias
        allowedFilters = transformFilters({aliasId: 1}, {aliasMapping: {aliasId: 'id'}, allowed: ['id']});
        expect(allowedFilters).toEqual([{type: 'where', query: 'id = :filter_id', bindings: {'filter_id': 1}}] as FiltersTransformed);

        // filter with custom queryBindingKey
        allowedFilters = transformFilters({id: 1}, {allowed: ['id'], queryBindingKeyFn: key => key});
        expect(allowedFilters).toEqual([{type: 'where', query: 'id = :id', bindings: {'id': 1}}] as FiltersTransformed);

        // filter with query alias
        allowedFilters = transformFilters({id: 1}, {queryAlias: 'user', allowed: ['id']});
        expect(allowedFilters).toEqual([{type: 'where', query: 'user.id = :filter_user_id', bindings: {'filter_user_id': 1}}] as FiltersTransformed);

        // filter allowed
        allowedFilters = transformFilters({name: 'tada5hi'}, {allowed: ['name']});
        expect(allowedFilters).toEqual( [{type: 'where', query: 'name = :filter_name', bindings: {'filter_name': 'tada5hi'}}] as FiltersTransformed);

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

    it('should transform filters with different operators', () => {
        // equal operator
        let data = transformFilters({id: '1'}, {allowed: ['id']});
        expect(data).toEqual([
            {type: 'where', query: 'id = :filter_id', bindings: {'filter_id': '1'}}
        ] as FiltersTransformed);

        // negation with equal operator
        data = transformFilters({id: '!1'}, {allowed: ['id']});
        expect(data).toEqual([
            {type: 'where', query: 'id != :filter_id', bindings: {'filter_id': '1'}}
        ] as FiltersTransformed);

        // in operator
        data = transformFilters({id: '1,2,3'}, {allowed: ['id']});
        expect(data).toEqual([
            {type: 'where', query: 'id IN (:...filter_id)', bindings: {'filter_id': ["1","2","3"]}}
        ] as FiltersTransformed);

        // negation with in operator
        data = transformFilters({id: '!1,2,3'}, {allowed: ['id']});
        expect(data).toEqual([
            {type: 'where', query: 'id NOT IN (:...filter_id)', bindings: {'filter_id': ["1","2","3"]}}
        ] as FiltersTransformed);

        // like operator
        data = transformFilters({name: '~name'}, {allowed: ['name']});
        expect(data).toEqual([
            {type: 'where', query: 'name LIKE :filter_name', bindings: {'filter_name': 'name%'}}
        ] as FiltersTransformed);

        // negation with like operator
        data = transformFilters({name: '!~name'}, {allowed: ['name']});
        expect(data).toEqual([
            {type: 'where', query: 'name NOT LIKE :filter_name', bindings: {'filter_name': 'name%'}}
        ] as FiltersTransformed);
    });

    it('should transform filters with includes', () => {
        const includes = transformIncludes(['profile', 'user_roles.role']);

        const options : FiltersOptions = {
            allowed: ['id', 'profile.id', 'role.id'],
            includes: includes,
        };

        // simple
        let transformed = transformFilters({id: 1, 'profile.id': 2}, options);
        expect(transformed).toEqual([
            {type: 'where', query: 'id = :filter_id', bindings: {'filter_id': 1}},
            {type: 'andWhere', query: 'profile.id = :filter_profile_id', bindings: {'filter_profile_id': 2}}
        ] as FiltersTransformed);

        // with include & query alias
        transformed = transformFilters({id: 1, 'profile.id': 2}, {...options, queryAlias: 'user'});
        expect(transformed).toEqual([
            {type: 'where', query: 'user.id = :filter_user_id', bindings: {'filter_user_id': 1}},
            {type: 'andWhere', query: 'profile.id = :filter_profile_id', bindings: {'filter_profile_id': 2}}
        ] as FiltersTransformed);

        // with deep nested include
        transformed = transformFilters({id: 1, 'role.id': 2}, options);
        expect(transformed).toEqual([
            {type: 'where', query: 'id = :filter_id', bindings: {'filter_id': 1}},
            {type: 'andWhere', query: 'role.id = :filter_role_id', bindings: {'filter_role_id': 2}}
        ] as FiltersTransformed);
    });

    it('should apply filters', () => {
        const queryBuilder = new FakeSelectQueryBuilder();

        let data = applyFilters(queryBuilder, {id: 1}, {allowed: ['id']});
        expect(data).toEqual([
            {type: 'where', query: 'id = :filter_id', bindings: {'filter_id': 1}}
        ] as FiltersTransformed);

        // backward test
        data = applyRequestFilters(queryBuilder, {id: 1}, {id: 'id'}, {allowed: ['id']});
        expect(data).toEqual([
            {type: 'where', query: 'id = :filter_id', bindings: {'filter_id': 1}}
        ] as FiltersTransformed);

        data = applyRequestFilter(queryBuilder, {id: 1}, {id: 'id'}, {allowed: ['id']});
        expect(data).toEqual([
            {type: 'where', query: 'id = :filter_id', bindings: {'filter_id': 1}}
        ] as FiltersTransformed);
    });
});
