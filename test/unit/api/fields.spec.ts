import {
    applyRequestFields
} from "../../../src";

import {
    ALTERNATIVE_DEFAULT_DOMAIN_KEY,
    transformAliasMappingFields,
    transformAllowedDomainFields,
    transformRequestFields
} from "../../../src/api/fields";

import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";

describe('src/api/fields.ts', () => {
    it('should transform allowed domain fields', () => {
        const fields : string[] = ['id','name'];

        let transformedFields = transformAllowedDomainFields(fields);
        expect(transformedFields).toEqual({[ALTERNATIVE_DEFAULT_DOMAIN_KEY]: fields});

        transformedFields = transformAllowedDomainFields({domain: fields});
        expect(transformedFields).toEqual({domain: fields});

        transformedFields = transformAllowedDomainFields({});
        expect(transformedFields).toEqual({});
    });

    it('should transform request fields', () => {
        const allowedFields : Record<string, string[]> = {
            [ALTERNATIVE_DEFAULT_DOMAIN_KEY]: ['id', 'name']
        };

        let options = {};

        let transformedRequestFields = transformRequestFields(undefined, allowedFields, options);
        expect(transformedRequestFields).toEqual({});

        transformedRequestFields = transformRequestFields(['id'], allowedFields, options);
        expect(transformedRequestFields).toEqual({[ALTERNATIVE_DEFAULT_DOMAIN_KEY]: ['id']});

        transformedRequestFields = transformRequestFields('id', allowedFields, options);
        expect(transformedRequestFields).toEqual({[ALTERNATIVE_DEFAULT_DOMAIN_KEY]: ['id']});

        transformedRequestFields = transformRequestFields('id', {}, options);
        expect(transformedRequestFields).toEqual({});

        transformedRequestFields = transformRequestFields('avatar', allowedFields, options);
        expect(transformedRequestFields).toEqual({});

        transformedRequestFields = transformRequestFields({id: null}, allowedFields, options);
        expect(transformedRequestFields).toEqual({});
    });

    it('should apply request fields', () => {
        const queryBuilder = new FakeSelectQueryBuilder();

        let appliedRequestFields = applyRequestFields(queryBuilder, [], []);
        expect(appliedRequestFields).toBeDefined();
        expect(appliedRequestFields).toEqual({});

        appliedRequestFields = applyRequestFields(queryBuilder, ['id'], ['id']);
        expect(appliedRequestFields).toEqual({[ALTERNATIVE_DEFAULT_DOMAIN_KEY]: ['id']});

        appliedRequestFields = applyRequestFields(queryBuilder, ['id'], ['id'], {
            requestDefaultKey: 'abc'
        });
        expect(appliedRequestFields).toEqual({['abc']: ['id']});

        // if only one domain is given, try to parse request field to single domain.
        appliedRequestFields = applyRequestFields(queryBuilder, ['id'], {domain: ['id']});
        expect(appliedRequestFields).toEqual({domain: ['id']});

        // if multiple possibilities are available for request field, than parse to none
        appliedRequestFields = applyRequestFields(queryBuilder, ['id'], {domain: ['id'], domain2: ['id']});
        expect(appliedRequestFields).toEqual({});
    });

    it('should transform allowed fields', () => {
        const fields : string[] = ['id'];

        let transformedFields = transformAliasMappingFields(fields);
        expect(transformedFields).toEqual({[fields[0]]: fields[0]});

        transformedFields = transformAliasMappingFields({idAlias: 'id'});
        expect(transformedFields).toEqual({idAlias: 'id'});
    });
})
