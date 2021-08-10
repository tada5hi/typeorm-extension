import {
    DEFAULT_ALIAS_ID,
    buildDomainFields,
    transformFields, FieldsOptions, applyFields, applyRequestFields
} from "../../../src/api/fields";
import {transformIncludes} from "../../../src/api/includes";
import {buildAliasMapping} from "../../../src/api/utils";

import {FakeSelectQueryBuilder} from "../../data/typeorm/FakeSelectQueryBuilder";

describe('src/api/fields.ts', () => {
    it('should transform allowed domain fields', () => {
        const fields : string[] = ['id','name'];

        let transformedFields = buildDomainFields(fields);
        expect(transformedFields).toEqual({[DEFAULT_ALIAS_ID]: fields});

        transformedFields = buildDomainFields({domain: fields});
        expect(transformedFields).toEqual({domain: fields});

        transformedFields = buildDomainFields({});
        expect(transformedFields).toEqual({});
    });

    it('should transform fields', () => {
        const options : FieldsOptions = {
            allowed: {
                [DEFAULT_ALIAS_ID]: ['id', 'name']
            }
        };

        // fields undefined
        let data = transformFields(undefined, options);
        expect(data).toEqual({});

        // fields as array
        data = transformFields(['id'], options);
        expect(data).toEqual({[DEFAULT_ALIAS_ID]: ['id']});

        // fields as string
        data = transformFields('id', options);
        expect(data).toEqual({[DEFAULT_ALIAS_ID]: ['id']});

        // multiple fields but only one valid field
        data = transformFields(['id', 'avatar'], options);
        expect(data).toEqual({[DEFAULT_ALIAS_ID]: ['id']});

        // empty allowed -> allows nothing
        data = transformFields('id', {...options, allowed: []});
        expect(data).toEqual({});

        // undefined allowed -> allows everything
        data = transformFields('id', {...options, allowed: undefined});
        expect(data).toEqual({[DEFAULT_ALIAS_ID]: ['id']});

        // field not allowed
        data = transformFields('avatar', options);
        expect(data).toEqual({});

        // field with invalid value
        data = transformFields({id: null}, options);
        expect(data).toEqual({});

        // if only one domain is given, try to parse request field to single domain.
        data = transformFields( ['id'], {allowed: {domain: ['id']}});
        expect(data).toEqual({domain: ['id']});

        // if multiple possibilities are available for request field, than parse to none
        data = transformFields( ['id'], {allowed: {domain: ['id'], domain2: ['id']}});
        expect(data).toEqual({});
    });

    it('should transform fields with includes', () => {
        const includes = transformIncludes(['profile', 'roles'], {allowed: ['user', 'profile']});

        // simple domain match
        let data = transformFields( {profile: ['id']}, {allowed: {profile: ['id']}, includes: includes});
        expect(data).toEqual({profile: ['id']});

        // only single domain match
        data = transformFields( {profile: ['id'], permissions: ['id']}, {allowed: {profile: ['id'], permissions: ['id']}, includes: includes});
        expect(data).toEqual({profile: ['id']});
    });

    it('should apply fields', () => {
        const queryBuilder = new FakeSelectQueryBuilder();

        let appliedRequestFields = applyFields(queryBuilder, [], {});
        expect(appliedRequestFields).toBeDefined();
        expect(appliedRequestFields).toEqual({});

        // backwards compatibility
        appliedRequestFields = applyRequestFields(queryBuilder, [], {});
        expect(appliedRequestFields).toBeDefined();
        expect(appliedRequestFields).toEqual({});
    });

    it('should transform allowed fields', () => {
        const fields : string[] = ['id'];

        let transformedFields = buildAliasMapping(fields);
        expect(transformedFields).toEqual({[fields[0]]: fields[0]});

        transformedFields = buildAliasMapping({idAlias: 'id'});
        expect(transformedFields).toEqual({idAlias: 'id'});
    });
});
