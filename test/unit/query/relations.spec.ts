import {RelationsParseOutput} from "rapiq";
import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";
import {applyQueryRelations, applyRelations} from "../../../src";

describe('src/api/includes.ts', () => {
    it('should apply request includes', () => {
        const queryBuilder = new FakeSelectQueryBuilder();

        let value = applyQueryRelations(queryBuilder,'profile', {allowed: ['profile']});
        expect(value).toEqual([{key: 'profile', value: 'profile'}] as RelationsParseOutput);

        value = applyRelations(queryBuilder,'profile', {allowed: ['profile']});
        expect(value).toEqual([{key: 'profile', value: 'profile'}] as RelationsParseOutput);
    });
});
