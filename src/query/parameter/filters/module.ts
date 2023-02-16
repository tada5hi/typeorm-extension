import type { FiltersParseOutput } from 'rapiq';
import { FilterComparisonOperator, parseQueryFilters } from 'rapiq';

import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { Brackets } from 'typeorm';
import { buildKeyWithPrefix, getAliasForPath } from '../../utils';
import type {
    QueryFiltersApplyOptions,
    QueryFiltersApplyOutput,
    QueryFiltersOutput,
} from './type';

// --------------------------------------------------

export function transformParsedFilters<T extends ObjectLiteral = ObjectLiteral>(
    data: FiltersParseOutput,
    options: QueryFiltersApplyOptions<T> = {},
) : QueryFiltersOutput {
    options = options || {};

    const items : QueryFiltersOutput = [];

    for (let i = 0; i < data.length; i++) {
        const alias = getAliasForPath(options.relations, data[i].path) ||
            options.defaultAlias ||
            options.defaultPath;

        const fullKey : string = buildKeyWithPrefix(data[i].key, alias);

        const filter = data[i];

        const statement : string[] = [
            fullKey,
        ];

        let bindingKey : string | undefined = typeof options.bindingKey === 'function' ?
            options.bindingKey(fullKey) :
            undefined;

        if (typeof bindingKey === 'undefined') {
            bindingKey = `filter_${fullKey.replace('.', '_')}`;
        }

        if (filter.value === null || typeof filter.value === 'undefined') {
            statement.push('IS');

            if (filter.operator === FilterComparisonOperator.NOT_EQUAL) {
                statement.push('NOT');
            }

            statement.push('NULL');

            items.push({
                statement: statement.join(' '),
                binding: {},
            });

            continue;
        }

        switch (filter.operator) {
            case FilterComparisonOperator.EQUAL:
            case FilterComparisonOperator.NOT_EQUAL: {
                if (filter.operator === FilterComparisonOperator.EQUAL) {
                    statement.push('=');
                } else {
                    statement.push('!=');
                }

                statement.push(`:${bindingKey}`);
                break;
            }
            case FilterComparisonOperator.LIKE:
            case FilterComparisonOperator.NOT_LIKE: {
                if (filter.operator === FilterComparisonOperator.NOT_LIKE) {
                    statement.push('NOT');
                }

                statement.push('LIKE');

                statement.push(`:${bindingKey}`);

                filter.value += '%';
                break;
            }

            case FilterComparisonOperator.IN:
            case FilterComparisonOperator.NOT_IN: {
                if (filter.operator === FilterComparisonOperator.NOT_IN) {
                    statement.push('NOT');
                }

                statement.push('IN');

                statement.push(`(:...${bindingKey})`);

                if (Array.isArray(filter.value)) {
                    const nullIndex = (filter.value as unknown[]).indexOf(null);
                    if (nullIndex !== -1) {
                        filter.value.splice(nullIndex, 1);

                        statement.unshift('(');
                        if (filter.operator === FilterComparisonOperator.NOT_IN) {
                            statement.push('AND');
                        } else {
                            statement.push('OR');
                        }
                        statement.push(fullKey);
                        statement.push('IS');

                        if (filter.operator === FilterComparisonOperator.NOT_IN) {
                            statement.push('NOT');
                        }

                        statement.push('NULL');
                        statement.push(')');
                    }
                }
                break;
            }
            case FilterComparisonOperator.LESS_THAN:
            case FilterComparisonOperator.LESS_THAN_EQUAL:
            case FilterComparisonOperator.GREATER_THAN:
            case FilterComparisonOperator.GREATER_THAN_EQUAL: {
                if (filter.operator === FilterComparisonOperator.LESS_THAN) {
                    statement.push('<');
                } else if (filter.operator === FilterComparisonOperator.LESS_THAN_EQUAL) {
                    statement.push('<=');
                } else if (filter.operator === FilterComparisonOperator.GREATER_THAN) {
                    statement.push('>');
                } else {
                    statement.push('>=');
                }

                statement.push(`:${bindingKey}`);
                break;
            }
        }

        items.push({
            statement: statement.join(' '),
            binding: { [bindingKey]: filter.value },
        });
    }

    return items;
}

/**
 * Apply transformed filter[s] parameter data on the db query.
 *
 * @param query
 * @param data
 */
export function applyFiltersTransformed<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: QueryFiltersOutput,
) : QueryFiltersOutput {
    if (data.length === 0) {
        return data;
    }

    /* istanbul ignore next */
    query.andWhere(new Brackets((qb) => {
        for (let i = 0; i < data.length; i++) {
            if (i === 0) {
                qb.where(data[i].statement, data[i].binding);
            } else {
                qb.andWhere(data[i].statement, data[i].binding);
            }
        }
    }));

    return data;
}

/**
 * Apply parsed filter[s] parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyQueryFiltersParseOutput<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: FiltersParseOutput,
    options?: QueryFiltersApplyOptions<T>,
) : QueryFiltersApplyOutput {
    applyFiltersTransformed(query, transformParsedFilters<T>(data, options));

    return data;
}

// --------------------------------------------------

/**
 * Apply raw filter[s] parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyQueryFilters<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: QueryFiltersApplyOptions<T>,
) : QueryFiltersApplyOutput {
    options = options || {};
    if (options.defaultAlias) {
        options.defaultPath = options.defaultAlias;
    }

    return applyQueryFiltersParseOutput(
        query,
        parseQueryFilters(data, options),
        options,
    );
}

/**
 * Apply raw filter[s] parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyFilters<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: QueryFiltersApplyOptions<T>,
) : QueryFiltersApplyOutput {
    return applyQueryFilters(query, data, options);
}
