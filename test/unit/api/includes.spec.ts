import {applyRequestIncludes} from "../../../src";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";
import {transformRequestIncludes} from "../../../src/api/includes";

describe('src/api/includes.ts', () => {
    it('should transform request includes', () => {
        let allowedIncludes = transformRequestIncludes('profile', {profile: 'profile'});
        expect(allowedIncludes).toEqual(['profile']);

        allowedIncludes = transformRequestIncludes(['profile'], {profile: 'profile'});
        expect(allowedIncludes).toEqual(['profile']);

        allowedIncludes = transformRequestIncludes(['profile'], {});
        expect(allowedIncludes).toEqual([]);

        allowedIncludes = transformRequestIncludes(null, {});
        expect(allowedIncludes).toEqual([]);
    })

    it('should apply request includes', () => {
        const queryBuilder = new FakeSelectQueryBuilder();

        let appliedRequestIncludes = applyRequestIncludes(queryBuilder, 'user','profile', {profile: 'profile'});
        expect(appliedRequestIncludes).toEqual(['profile']);

        appliedRequestIncludes = applyRequestIncludes(queryBuilder, 'user',['profile'], {profile: 'profile'});
        expect(appliedRequestIncludes).toEqual(['profile']);

        appliedRequestIncludes = applyRequestIncludes(queryBuilder, 'user',['profile'], {});
        expect(appliedRequestIncludes).toEqual([]);
    });
});
