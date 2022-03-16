import { Parameter, ParseOutput } from '@trapi/query';

import { SelectQueryBuilder } from 'typeorm';
import {
    applyQueryFieldsParseOutput,
    applyQueryFiltersParseOutput,
    applyQueryPaginationParseOutput,
    applyQueryRelationsParseOutput,
} from './parameter';

export function applyQueryParseOutput<T>(
    query: SelectQueryBuilder<T>,
    context: ParseOutput,
) : ParseOutput {
    const keys = Object.keys(context);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i] as `${Parameter}`;

        switch (key) {
            case Parameter.FIELDS:
                applyQueryFieldsParseOutput(query, context[key]);
                break;
            case Parameter.FILTERS:
                applyQueryFiltersParseOutput(query, context[key]);
                break;
            case Parameter.PAGINATION:
                applyQueryPaginationParseOutput(query, context[key]);
                break;
            case Parameter.RELATIONS:
                applyQueryRelationsParseOutput(query, context[key]);
                break;
            case Parameter.SORT:
                applyQueryRelationsParseOutput(query, context[key]);
                break;
        }
    }

    return context;
}
