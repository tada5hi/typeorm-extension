import {applySort, applySortTransformed, transformSort} from "../../../src/api/sort";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";

describe('src/api/sort.ts', () => {
    it('should transform request sort data', () => {
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
