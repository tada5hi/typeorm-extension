import {RelationsParseOutput} from "rapiq";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";
import {applyQueryRelations, applyRelations} from "../../../src";

describe('src/api/includes.ts', () => {
    it('should apply request includes', () => {
        const queryBuilder = new FakeSelectQueryBuilder();

        let value = applyQueryRelations(queryBuilder,'profile', {allowed: ['profile']});
        expect(value).toEqual([{key: 'profile', value: 'profile'}] as RelationsParseOutput);

        value = applyRelations(queryBuilder,'profile', {allowed: ['profile'], defaultAlias: 'user'});
        expect(value).toEqual([{key: 'user.profile', value: 'profile'}] as RelationsParseOutput);

        value = applyQueryRelations(queryBuilder,['profile', 'user_roles.role'], {
            allowed: ['profile', 'user_roles.role']
        });
        expect(value).toEqual([
            {key: 'user_roles', value: 'user_roles'},
            {key: 'profile', value: 'profile'},
            {key: 'user_roles.role', value: 'role'},
        ] as RelationsParseOutput);

        value = applyQueryRelations(queryBuilder,['profile', 'user_roles.role'], {
            allowed: ['profile', 'user_roles.role'],
            defaultAlias: 'user'
        });
        expect(value).toEqual([
            {key: 'user.user_roles', value: 'user_roles'},
            {key: 'user.profile', value: 'profile'},
            {key: 'user_roles.role', value: 'role'},
        ] as RelationsParseOutput);
    });
});
