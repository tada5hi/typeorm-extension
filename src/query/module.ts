import { ParseOutput, parseQuery } from 'rapiq';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import {
    applyQueryFieldsParseOutput,
    applyQueryFiltersParseOutput,
    applyQueryPaginationParseOutput,
    applyQueryRelationsParseOutput,
    applyQuerySortParseOutput,
} from './parameter';
import { QueryApplyOptions, QueryApplyOutput } from './type';

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
    input: unknown,
    options?: QueryApplyOptions<T>,
) : QueryApplyOutput {
    if (options.defaultAlias) {
        options.defaultPath = options.defaultAlias;
    }

    const output = applyQueryParseOutput(query, parseQuery(input, options));

    return {
        ...output,
        ...(options.defaultAlias ? { defaultAlias: options.defaultAlias } : {}),
    };
}
