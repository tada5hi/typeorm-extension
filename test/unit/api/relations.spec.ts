import {RelationsParsed} from "@trapi/query";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";
import {applyQueryRelations} from "../../../src";

describe('src/api/includes.ts', () => {
    it('should apply request includes', () => {
        const queryBuilder = new FakeSelectQueryBuilder();

        const value = applyQueryRelations(queryBuilder,'profile', {allowed: ['profile']});
        expect(value).toEqual([{key: 'profile', value: 'profile'}] as RelationsParsed);
    });
});
