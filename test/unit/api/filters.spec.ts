import {FiltersParseOptions, parseQueryFilters, parseQueryRelations} from "@trapi/query";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";
import {
    applyFiltersTransformed, applyQueryFilters,
    applyQueryFiltersParseOutput, FiltersApplyOutput,
    FiltersTransformOutput,
    transformParsedFilters
} from "../../../src";

describe('src/api/filters.ts', () => {
    const queryBuilder = new FakeSelectQueryBuilder();

    it('should transform request filters', () => {
        // filter id
        let allowedFilters = transformParsedFilters(parseQueryFilters({id: 1}));
        expect(allowedFilters).toEqual([{statement: 'id = :filter_id', binding: {'filter_id': 1}}]  as FiltersTransformOutput);

        // filter none
        allowedFilters = transformParsedFilters(parseQueryFilters({id: 1}, {allowed: []}));
        expect(allowedFilters).toEqual([]  as FiltersTransformOutput);

        // filter with alias
        allowedFilters = transformParsedFilters(parseQueryFilters({aliasId: 1}, {aliasMapping: {aliasId: 'id'}, allowed: ['id']}));
        expect(allowedFilters).toEqual([{statement: 'id = :filter_id', binding: {'filter_id': 1}}] as FiltersTransformOutput);

        // filter with custom queryBindingKey
        allowedFilters = transformParsedFilters(parseQueryFilters({id: 1}, {allowed: ['id']}), {bindingKeyFn: key => key});
        expect(allowedFilters).toEqual([{statement: 'id = :id', binding: {'id': 1}}] as FiltersTransformOutput);

        // filter with query alias
        allowedFilters = transformParsedFilters(parseQueryFilters({id: 1}, {defaultAlias: 'user', allowed: ['id']}));
        expect(allowedFilters).toEqual([{statement: 'user.id = :filter_user_id', binding: {'filter_user_id': 1}}] as FiltersTransformOutput);

        // filter allowed
        allowedFilters = transformParsedFilters(parseQueryFilters({name: 'tada5hi'}, {allowed: ['name']}));
        expect(allowedFilters).toEqual( [{statement: 'name = :filter_name', binding: {'filter_name': 'tada5hi'}}] as FiltersTransformOutput);

        // filter data with el empty value
        allowedFilters = transformParsedFilters(parseQueryFilters({name: ''}, {allowed: ['name']}));
        expect(allowedFilters).toEqual([] as FiltersTransformOutput);

        // filter data with el null value
        allowedFilters = transformParsedFilters(parseQueryFilters({name: null}, {allowed: ['name']}));
        expect(allowedFilters).toEqual([] as FiltersTransformOutput);

        // filter wrong allowed
        allowedFilters = transformParsedFilters(parseQueryFilters({id: 1}, {allowed: ['name']}));
        expect(allowedFilters).toEqual([] as FiltersTransformOutput);

        // filter empty data
        allowedFilters = transformParsedFilters(parseQueryFilters({}, {allowed: ['name']}));
        expect(allowedFilters).toEqual([] as FiltersTransformOutput);
    });

    it('should transform filters with different operators', () => {
        // equal operator
        let data = transformParsedFilters(parseQueryFilters({id: '1'}, {allowed: ['id']}));
        expect(data).toEqual([
            {statement: 'id = :filter_id', binding: {'filter_id': '1'}}
        ] as FiltersTransformOutput);

        // negation with equal operator
        data = transformParsedFilters(parseQueryFilters({id: '!1'}, {allowed: ['id']}));
        expect(data).toEqual([
            {statement: 'id != :filter_id', binding: {'filter_id': '1'}}
        ] as FiltersTransformOutput);

        // in operator
        data = transformParsedFilters(parseQueryFilters({id: '1,2,3'}, {allowed: ['id']}));
        expect(data).toEqual([
            {statement: 'id IN (:...filter_id)', binding: {'filter_id': ["1","2","3"]}}
        ] as FiltersTransformOutput);

        // negation with in operator
        data = transformParsedFilters(parseQueryFilters({id: '!1,2,3'}, {allowed: ['id']}));
        expect(data).toEqual([
            {statement: 'id NOT IN (:...filter_id)', binding: {'filter_id': ["1","2","3"]}}
        ] as FiltersTransformOutput);

        // like operator
        data = transformParsedFilters(parseQueryFilters({name: '~name'}, {allowed: ['name']}));
        expect(data).toEqual([
            {statement: 'name LIKE :filter_name', binding: {'filter_name': 'name%'}}
        ] as FiltersTransformOutput);

        // negation with like operator
        data = transformParsedFilters(parseQueryFilters({name: '!~name'}, {allowed: ['name']}));
        expect(data).toEqual([
            {statement: 'name NOT LIKE :filter_name', binding: {'filter_name': 'name%'}}
        ] as FiltersTransformOutput);
    });

    it('should transform filters with includes', () => {
        const includes = parseQueryRelations(['profile', 'user_roles.role']);

        const options : FiltersParseOptions = {
            allowed: ['id', 'profile.id', 'role.id'],
            relations: includes,
        };

        // simple
        let transformed = transformParsedFilters(parseQueryFilters({id: 1, 'profile.id': 2}, options));
        expect(transformed).toEqual([
            {statement: 'id = :filter_id', binding: {'filter_id': 1}},
            {statement: 'profile.id = :filter_profile_id', binding: {'filter_profile_id': 2}}
        ] as FiltersTransformOutput);

        // with include & query alias
        transformed = transformParsedFilters(parseQueryFilters({id: 1, 'profile.id': 2}, {...options, defaultAlias: 'user'}));
        expect(transformed).toEqual([
            {statement: 'user.id = :filter_user_id', binding: {'filter_user_id': 1}},
            {statement: 'profile.id = :filter_profile_id', binding: {'filter_profile_id': 2}}
        ] as FiltersTransformOutput);

        // with deep nested include
        transformed = transformParsedFilters(parseQueryFilters({id: 1, 'role.id': 2}, options));
        expect(transformed).toEqual([
            {statement: 'id = :filter_id', binding: {'filter_id': 1}},
            {statement: 'role.id = :filter_role_id', binding: {'filter_role_id': 2}}
        ] as FiltersTransformOutput);
    });

    it('should apply filters parse output', () => {
        const data = applyQueryFiltersParseOutput(queryBuilder, parseQueryFilters({id: 1}, {allowed: ['id']}));
        expect(data).toEqual([
            {key: 'id', operator: {}, value: 1}
        ] as FiltersApplyOutput);
    });

    it('should apply filters transform output', () => {
        let data = applyFiltersTransformed(queryBuilder, transformParsedFilters(
            parseQueryFilters(
                {id: 1}, {allowed: ['id']}
            )
        ));

        expect(data).toEqual([
            {statement: 'id = :filter_id', binding: {'filter_id': 1}}
        ]);

        data = applyFiltersTransformed(queryBuilder,[]);
        expect(data).toEqual([]);
    });

    it('should apply query filters', () => {
        const data = applyQueryFilters(queryBuilder, {id: 1}, {allowed: ['id']});

        expect(data).toEqual([
            {key: 'id', operator: {}, value: 1}
        ]);
    });
});
