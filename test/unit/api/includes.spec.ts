import {applyRequestIncludes} from "../../../src";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";
import {applyIncludes, transformIncludes} from "../../../src/api/includes";

describe('src/api/includes.ts', () => {
    it('should transform request includes', () => {
        // single data matching
        let allowedIncludes = transformIncludes('profile', {allowed: ['profile']});
        expect(allowedIncludes).toEqual([
            {property: 'profile', alias: 'profile'}
        ]);

        allowedIncludes = transformIncludes([], {allowed: ['profile']});
        expect(allowedIncludes).toEqual([]);

        // with alias
        allowedIncludes = transformIncludes('pro', {aliasMapping: {pro: 'profile'}, allowed: ['profile']});
        expect(allowedIncludes).toEqual([
            {property: 'profile', alias: 'profile'}
        ]);

        // with alias & string case
        allowedIncludes = transformIncludes('pro', {aliasMapping: {PRO: 'profile'}, allowed: ['profile'], stringCase: 'snakeCase'});
        expect(allowedIncludes).toEqual([
            {property: 'profile', alias: 'profile'}
        ]);

        // with nested alias
        allowedIncludes = transformIncludes(['abc.photos'], {
            allowed: ['profile.photos'],
            queryAlias: 'user',
            aliasMapping: {'abc.photos': 'profile.photos'}
        });
        expect(allowedIncludes).toEqual([
            {property: 'user.profile', alias: 'profile'},
            {property: 'profile.photos', alias: 'photos'}
        ]);

        // with nested alias & includeParents
        allowedIncludes = transformIncludes(['abc.photos'], {
            allowed: ['profile.photos'],
            queryAlias: 'user',
            aliasMapping: {'abc.photos': 'profile.photos'},
            includeParents: false
        });
        expect(allowedIncludes).toEqual([
            {property: 'profile.photos', alias: 'photos'}
        ]);

        // with nested alias & limited includeParents ( no user_roles rel)
        allowedIncludes = transformIncludes(['abc.photos', 'user_roles.role'], {
            allowed: ['profile.photos', 'user_roles.role'],
            queryAlias: 'user',
            aliasMapping: {'abc.photos': 'profile.photos'},
            includeParents: ['profile.**']
        });
        expect(allowedIncludes).toEqual([
            {property: 'user.profile', alias: 'profile'},
            {property: 'profile.photos', alias: 'photos'},
            {property: 'user_roles.role', alias: 'role'}
        ]);


        // multiple data matching
        allowedIncludes = transformIncludes(['profile', 'abc'], {allowed: ['profile']});
        expect(allowedIncludes).toEqual([{property: 'profile', alias: 'profile'}]);

        // no allowed
        allowedIncludes = transformIncludes(['profile'], {allowed: []});
        expect(allowedIncludes).toEqual([]);

        // all allowed
        allowedIncludes = transformIncludes(['profile'], {allowed: undefined});
        expect(allowedIncludes).toEqual([{property: 'profile', alias: 'profile'}]);

        // nested data with alias
        allowedIncludes = transformIncludes(['profile.photos', 'profile.photos.abc', 'profile.abc'], {allowed: ['profile.photos'], queryAlias: 'user'});
        expect(allowedIncludes).toEqual([
            {property: 'user.profile', alias: 'profile'},
            {property: 'profile.photos', alias: 'photos'}
        ]);

        // nested data with alias
        allowedIncludes = transformIncludes(['profile.photos', 'profile.photos.abc', 'profile.abc'], {allowed: ['profile.photos**'], queryAlias: 'user'});
        expect(allowedIncludes).toEqual([
            {property: 'user.profile', alias: 'profile'},
            {property: 'profile.photos', alias: 'photos'},
            {property: 'photos.abc', alias: 'abc'}
        ]);

        // null data
        allowedIncludes = transformIncludes(null);
        expect(allowedIncludes).toEqual([]);
    });

    it('should apply request includes', () => {
        const queryBuilder = new FakeSelectQueryBuilder();

        let appliedRequestIncludes = applyIncludes(queryBuilder,'profile', {allowed: ['profile']});
        expect(appliedRequestIncludes).toEqual([{property: 'profile', alias: 'profile'}]);

        // backward compatibility
        appliedRequestIncludes = applyRequestIncludes(queryBuilder, 'profile',[]);
        expect(appliedRequestIncludes).toEqual([]);
    });
});
