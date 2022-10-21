import { Parameter, ParseOutput, parseQuery } from 'rapiq';
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
    const keys = Object.keys(context);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i] as `${Parameter}`;

        switch (key) {
            case Parameter.FIELDS:
                applyQueryFieldsParseOutput(query, context[key], {
                    defaultAlias: context.defaultPath,
                    relations: context.relations,
                });
                break;
            case Parameter.FILTERS:
                applyQueryFiltersParseOutput(query, context[key], {
                    defaultAlias: context.defaultPath,
                    relations: context.relations,
                });
                break;
            case Parameter.PAGINATION:
                applyQueryPaginationParseOutput(query, context[key]);
                break;
            case Parameter.RELATIONS:
                applyQueryRelationsParseOutput(query, context[key], {
                    defaultAlias: context.defaultPath,
                });
                break;
            case Parameter.SORT:
                applyQuerySortParseOutput(query, context[key]);
                break;
        }
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
