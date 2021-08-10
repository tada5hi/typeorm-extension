import {transformIncludes} from "../../../src";
import {applySort, applySortTransformed, SortOptions, transformSort} from "../../../src/api/sort";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";

describe('src/api/sort.ts', () => {
    it('should transform sort data', () => {
        // sort asc
        let transformed = transformSort('id', {allowed: ['id']});
        expect(transformed).toEqual({id: 'ASC'});

        // sort desc
        transformed = transformSort('-id', {allowed: ['id']});
        expect(transformed).toEqual({id: 'DESC'});

        // empty allowed
        transformed = transformSort('-id', {allowed: []});
        expect(transformed).toEqual({});

        // undefined allowed
        transformed = transformSort('-id', {allowed: undefined});
        expect(transformed).toEqual({id: 'DESC'});

        // wrong allowed
        transformed = transformSort('-id', {allowed: ['a']});
        expect(transformed).toEqual({});

        // array data
        transformed = transformSort(['-id'], {allowed: ['id']});
        expect(transformed).toEqual({id: 'DESC'});

        // object data
        transformed = transformSort({id: 'ASC'}, {allowed: ['id']});
        expect(transformed).toEqual({id: 'ASC'});

        // wrong input data data
        transformed = transformSort({id: 'Right'}, {allowed: ['id']});
        expect(transformed).toEqual({id: 'ASC'});

        // with query alias
        transformed = transformSort('-id',  {allowed: ['id'], queryAlias: 'user'});
        expect(transformed).toEqual({'user.id': 'DESC'});

        // with alias mapping
        transformed = transformSort('-pit',  {aliasMapping: {pit: 'id'}, allowed: ['id']});
        expect(transformed).toEqual({'id': 'DESC'});

        // with alias mapping & query alias
        transformed = transformSort('-pit', {aliasMapping: {pit: 'id'}, allowed: ['id'], queryAlias: 'user'});
        expect(transformed).toEqual({'user.id': 'DESC'});
    });

    it('should transform sort with sort indexes', () => {
        const options : SortOptions = {
            allowed: [
                ['name', 'email'],
                ['id']
            ]
        };

        // simple
        let transformed = transformSort(['id'], options);
        expect(transformed).toEqual({id: 'ASC'});

        // correct order
        transformed = transformSort(['name', 'email'], options);
        expect(transformed).toStrictEqual({name: 'ASC', email: 'ASC'});

        // incorrect order
        transformed = transformSort(['email', 'name'], options);
        expect(transformed).toStrictEqual({name: 'ASC', email: 'ASC'});

        // incomplete match
        transformed = transformSort(['email', 'id'], options);
        expect(transformed).toStrictEqual({id: 'ASC'});

        // no match
        transformed = transformSort(['email'], options);
        expect(transformed).toStrictEqual({});
    });

    it('should transform sort data with includes', () => {
        const includes = transformIncludes(['profile', 'user_roles.role']);

        const options : SortOptions = {
            allowed: ['id', 'profile.id', 'user_roles.role.id'],
            includes: includes,
        };

        // simple
        let transformed = transformSort(['id'], options);
        expect(transformed).toEqual({id: 'ASC'});

        // with query alias
        transformed = transformSort(['id'], {...options, queryAlias: 'user'});
        expect(transformed).toEqual({'user.id': 'ASC'});

        // with include
        transformed = transformSort(['id', 'profile.id'], options);
        expect(transformed).toEqual({'id': 'ASC', 'profile.id': 'ASC'});

        // with include & query alias
        transformed = transformSort(['id', 'profile.id'], {...options, queryAlias: 'user'});
        expect(transformed).toEqual({'user.id': 'ASC', 'profile.id': 'ASC'});

        // with include
        transformed = transformSort(['id', 'profile.id'], options);
        expect(transformed).toEqual({'id': 'ASC', 'profile.id': 'ASC'});

        // with deep nested include
        transformed = transformSort(['id', 'user_roles.role.id', 'user_roles.user.id'], options);
        expect(transformed).toEqual({'id': 'ASC', 'user_roles.role.id': 'ASC'});
    });

    it('should apply sort transformed', () => {
        const query = new FakeSelectQueryBuilder();
        const transformed = transformSort('id', {allowed: ['id']});
        const applied = applySortTransformed(query, transformed);
        expect(applied).toBeDefined();
    });

    it('should apply sort', () => {
        const query = new FakeSelectQueryBuilder();
        const applied = applySort(query, 'id', {allowed: ['id']});
        expect(applied).toBeDefined();
    });
});
