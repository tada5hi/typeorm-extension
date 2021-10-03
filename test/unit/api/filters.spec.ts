import {FiltersParseOptions, parseFilters, parseRelations} from "@trapi/query";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";
import {
    applyParsedQueryFilters,
    FiltersTransformed,
    transformParsedFilters
} from "../../../src/api/filters";

describe('src/api/filters.ts', () => {
    it('should transform request filters', () => {
        // filter id
        let allowedFilters = transformParsedFilters(parseFilters({id: 1}));
        expect(allowedFilters).toEqual([{statement: 'id = :filter_id', binding: {'filter_id': 1}}]  as FiltersTransformed);

        // filter none
        allowedFilters = transformParsedFilters(parseFilters({id: 1}, {allowed: []}));
        expect(allowedFilters).toEqual([]  as FiltersTransformed);

        // filter with alias
        allowedFilters = transformParsedFilters(parseFilters({aliasId: 1}, {aliasMapping: {aliasId: 'id'}, allowed: ['id']}));
        expect(allowedFilters).toEqual([{statement: 'id = :filter_id', binding: {'filter_id': 1}}] as FiltersTransformed);

        // filter with custom queryBindingKey
        allowedFilters = transformParsedFilters(parseFilters({id: 1}, {allowed: ['id']}), {bindingKeyFn: key => key});
        expect(allowedFilters).toEqual([{statement: 'id = :id', binding: {'id': 1}}] as FiltersTransformed);

        // filter with query alias
        allowedFilters = transformParsedFilters(parseFilters({id: 1}, {defaultAlias: 'user', allowed: ['id']}));
        expect(allowedFilters).toEqual([{statement: 'user.id = :filter_user_id', binding: {'filter_user_id': 1}}] as FiltersTransformed);

        // filter allowed
        allowedFilters = transformParsedFilters(parseFilters({name: 'tada5hi'}, {allowed: ['name']}));
        expect(allowedFilters).toEqual( [{statement: 'name = :filter_name', binding: {'filter_name': 'tada5hi'}}] as FiltersTransformed);

        // filter data with el empty value
        allowedFilters = transformParsedFilters(parseFilters({name: ''}, {allowed: ['name']}));
        expect(allowedFilters).toEqual([] as FiltersTransformed);

        // filter data with el null value
        allowedFilters = transformParsedFilters(parseFilters({name: null}, {allowed: ['name']}));
        expect(allowedFilters).toEqual([] as FiltersTransformed);

        // filter wrong allowed
        allowedFilters = transformParsedFilters(parseFilters({id: 1}, {allowed: ['name']}));
        expect(allowedFilters).toEqual([] as FiltersTransformed);

        // filter empty data
        allowedFilters = transformParsedFilters(parseFilters({}, {allowed: ['name']}));
        expect(allowedFilters).toEqual([] as FiltersTransformed);
    });

    it('should transform filters with different operators', () => {
        // equal operator
        let data = transformParsedFilters(parseFilters({id: '1'}, {allowed: ['id']}));
        expect(data).toEqual([
            {statement: 'id = :filter_id', binding: {'filter_id': '1'}}
        ] as FiltersTransformed);

        // negation with equal operator
        data = transformParsedFilters(parseFilters({id: '!1'}, {allowed: ['id']}));
        expect(data).toEqual([
            {statement: 'id != :filter_id', binding: {'filter_id': '1'}}
        ] as FiltersTransformed);

        // in operator
        data = transformParsedFilters(parseFilters({id: '1,2,3'}, {allowed: ['id']}));
        expect(data).toEqual([
            {statement: 'id IN (:...filter_id)', binding: {'filter_id': ["1","2","3"]}}
        ] as FiltersTransformed);

        // negation with in operator
        data = transformParsedFilters(parseFilters({id: '!1,2,3'}, {allowed: ['id']}));
        expect(data).toEqual([
            {statement: 'id NOT IN (:...filter_id)', binding: {'filter_id': ["1","2","3"]}}
        ] as FiltersTransformed);

        // like operator
        data = transformParsedFilters(parseFilters({name: '~name'}, {allowed: ['name']}));
        expect(data).toEqual([
            {statement: 'name LIKE :filter_name', binding: {'filter_name': 'name%'}}
        ] as FiltersTransformed);

        // negation with like operator
        data = transformParsedFilters(parseFilters({name: '!~name'}, {allowed: ['name']}));
        expect(data).toEqual([
            {statement: 'name NOT LIKE :filter_name', binding: {'filter_name': 'name%'}}
        ] as FiltersTransformed);
    });

    it('should transform filters with includes', () => {
        const includes = parseRelations(['profile', 'user_roles.role']);

        const options : FiltersParseOptions = {
            allowed: ['id', 'profile.id', 'role.id'],
            relations: includes,
        };

        // simple
        let transformed = transformParsedFilters(parseFilters({id: 1, 'profile.id': 2}, options));
        expect(transformed).toEqual([
            {statement: 'id = :filter_id', binding: {'filter_id': 1}},
            {statement: 'profile.id = :filter_profile_id', binding: {'filter_profile_id': 2}}
        ] as FiltersTransformed);

        // with include & query alias
        transformed = transformParsedFilters(parseFilters({id: 1, 'profile.id': 2}, {...options, defaultAlias: 'user'}));
        expect(transformed).toEqual([
            {statement: 'user.id = :filter_user_id', binding: {'filter_user_id': 1}},
            {statement: 'profile.id = :filter_profile_id', binding: {'filter_profile_id': 2}}
        ] as FiltersTransformed);

        // with deep nested include
        transformed = transformParsedFilters(parseFilters({id: 1, 'role.id': 2}, options));
        expect(transformed).toEqual([
            {statement: 'id = :filter_id', binding: {'filter_id': 1}},
            {statement: 'role.id = :filter_role_id', binding: {'filter_role_id': 2}}
        ] as FiltersTransformed);
    });

    it('should apply filters', () => {
        const queryBuilder = new FakeSelectQueryBuilder();

        const data = applyParsedQueryFilters(queryBuilder, parseFilters({id: 1}, {allowed: ['id']}));
        expect(data).toEqual([
            {statement: 'id = :filter_id', binding: {'filter_id': 1}}
        ] as FiltersTransformed);
    });
});
