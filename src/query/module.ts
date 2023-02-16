import type { ParseInput, ParseOutput } from 'rapiq';
import { parseQuery } from 'rapiq';
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import {
    applyQueryFieldsParseOutput,
    applyQueryFiltersParseOutput,
    applyQueryPaginationParseOutput,
    applyQueryRelationsParseOutput,
    applyQuerySortParseOutput,
} from './parameter';
import type { QueryApplyOptions, QueryApplyOutput } from './type';
import { isQueryOptionDefined } from './utils';

export function applyQueryParseOutput<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    context: ParseOutput,
): ParseOutput {
    if (context.fields) {
        applyQueryFieldsParseOutput(query, context.fields, {
            defaultAlias: context.defaultPath,
            relations: context.relations,
        });
    }

    if (context.filters) {
        applyQueryFiltersParseOutput(query, context.filters, {
            defaultAlias: context.defaultPath,
            relations: context.relations,
        });
    }

    if (context.pagination) {
        applyQueryPaginationParseOutput(query, context.pagination);
    }

    if (context.relations) {
        applyQueryRelationsParseOutput(query, context.relations, {
            defaultAlias: context.defaultPath,
        });
    }

    if (context.sort) {
        applyQuerySortParseOutput(query, context.sort);
    }

    return context;
}

export function applyQuery<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    input: ParseInput,
    options?: QueryApplyOptions<T>,
) : QueryApplyOutput {
    options = options || {};

    if (options.defaultAlias) {
        options.defaultPath = options.defaultAlias;
    }

    if (
        typeof options.fields === 'undefined' ||
        !isQueryOptionDefined(options.fields, ['allowed', 'default'])
    ) {
        options.fields = false;
    }

    if (
        typeof options.filters === 'undefined' ||
        !isQueryOptionDefined(options.filters, ['allowed', 'default'])
    ) {
        options.filters = false;
    }

    if (
        typeof options.pagination === 'undefined'
    ) {
        options.pagination = false;
    }

    if (
        typeof options.relations === 'undefined' ||
        !isQueryOptionDefined(options.relations, ['allowed'])
    ) {
        options.relations = false;
    }

    if (
        typeof options.sort === 'undefined' ||
        !isQueryOptionDefined(options.sort, ['allowed', 'default'])
    ) {
        options.sort = false;
    }

    const output = applyQueryParseOutput(query, parseQuery(input, options));

    return {
        ...output,
        ...(options.defaultAlias ? { defaultAlias: options.defaultAlias } : {}),
    };
}
