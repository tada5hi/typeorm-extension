import {
    DEFAULT_ALIAS_ID,
    buildDomainFields,
    transformFields, FieldsOptions, applyFields, applyRequestFields, FieldsTransformed
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
            allowed: ['id', 'name']
        };

        // fields undefined
        let data = transformFields(undefined, options);
        expect(data).toEqual([]);

        // fields as array
        data = transformFields(['id'], options);
        expect(data).toEqual([{fields: ['id']}] as FieldsTransformed);

        // fields as string
        data = transformFields('id', options);
        expect(data).toEqual([{fields: ['id']}] as FieldsTransformed);

        // multiple fields but only one valid field
        data = transformFields(['id', 'avatar'], options);
        expect(data).toEqual([{fields: ['id']}] as FieldsTransformed);

        // field as string and append fields
        data = transformFields('+id', options);
        expect(data).toEqual([{fields: ['id'], addFields: true}] as FieldsTransformed);

        // fields as string and append fields
        data = transformFields('id,+name', options);
        expect(data).toEqual([{fields: ['id', 'name'], addFields: true}] as FieldsTransformed);

        // empty allowed -> allows nothing
        data = transformFields('id', {...options, allowed: []});
        expect(data).toEqual([] as FieldsTransformed);

        // undefined allowed -> allows everything
        data = transformFields('id', {...options, allowed: undefined});
        expect(data).toEqual([{fields: ['id']}] as FieldsTransformed);

        // field not allowed
        data = transformFields('avatar', options);
        expect(data).toEqual([] as FieldsTransformed);

        // field with invalid value
        data = transformFields({id: null}, options);
        expect(data).toEqual([] as FieldsTransformed);

        // if only one domain is given, try to parse request field to single domain.
        data = transformFields( ['id'], {allowed: {domain: ['id']}});
        expect(data).toEqual([{fields: ['id'], alias: 'domain'}] as FieldsTransformed);

        // if multiple possibilities are available for request field, than parse to none
        data = transformFields( ['id'], {allowed: {domain: ['id'], domain2: ['id']}});
        expect(data).toEqual([] as FieldsTransformed);
    });

    it('should transform fields with includes', () => {
        const includes = transformIncludes(['profile', 'roles'], {allowed: ['user', 'profile']});

        // simple domain match
        let data = transformFields( {profile: ['id']}, {allowed: {profile: ['id']}, includes: includes});
        expect(data).toEqual([{fields: ['id'], alias: 'profile'}] as FieldsTransformed);

        // only single domain match
        data = transformFields( {profile: ['id'], permissions: ['id']}, {allowed: {profile: ['id'], permissions: ['id']}, includes: includes});
        expect(data).toEqual([{fields: ['id'], alias: 'profile'}] as FieldsTransformed);
    });

    it('should apply fields', () => {
        const queryBuilder = new FakeSelectQueryBuilder();

        let appliedRequestFields = applyFields(queryBuilder, [], {});
        expect(appliedRequestFields).toBeDefined();
        expect(appliedRequestFields).toEqual([] as FieldsTransformed);

        // backwards compatibility
        appliedRequestFields = applyRequestFields(queryBuilder, [], {});
        expect(appliedRequestFields).toBeDefined();
        expect(appliedRequestFields).toEqual([] as FieldsTransformed);
    });

    it('should transform allowed fields', () => {
        const fields : string[] = ['id'];

        let transformedFields = buildAliasMapping(fields);
        expect(transformedFields).toEqual({[fields[0]]: fields[0]});

        transformedFields = buildAliasMapping({idAlias: 'id'});
        expect(transformedFields).toEqual({idAlias: 'id'});
    });
});
