import {
    FiltersParseOutput,
    parseQueryFilters,
} from '@trapi/query';

import { Brackets, SelectQueryBuilder } from 'typeorm';
import {
    FiltersApplyOptions, FiltersApplyOutput, FiltersTransformOptions, FiltersTransformOutput,
} from './type';

// --------------------------------------------------

export function transformParsedFilters(
    data: FiltersParseOutput,
    options?: FiltersTransformOptions,
) : FiltersTransformOutput {
    options ??= {};

    const items : FiltersTransformOutput = [];

    for (let i = 0; i < data.length; i++) {
        const fullKey : string = (data[i].alias ? `${data[i].alias}.` : '') + data[i].key;

        const filter = data[i];
        filter.operator ??= {};

        const statement : string[] = [
            fullKey,
        ];

        if (
            typeof filter.value === 'undefined' ||
            filter.value === null ||
            `${filter.value}`.toLowerCase() === 'null'
        ) {
            statement.push('IS');

            if (filter.operator.negation) {
                statement.push('NOT');
            }

            statement.push('NULL');

            items.push({
                statement: statement.join(' '),
                binding: {},
            });
        } else if (
            typeof filter.value === 'string' ||
            typeof filter.value === 'number' ||
            typeof filter.value === 'boolean' ||
            Array.isArray(filter.value)
        ) {
            if (
                (
                    typeof filter.value === 'string' ||
                    typeof filter.value === 'number'
                ) &&
                filter.operator.like
            ) {
                filter.value += '%';
            }

            if (filter.operator.in || filter.operator.like) {
                if (filter.operator.negation) {
                    statement.push('NOT');
                }

                if (filter.operator.like) {
                    statement.push('LIKE');
                } else if (filter.operator.in) {
                    statement.push('IN');
                }
            } else if (filter.operator.negation) {
                statement.push('!=');
            } else if (filter.operator.lessThan) {
                statement.push('<');
            } else if (filter.operator.lessThanEqual) {
                statement.push('<=');
            } else if (filter.operator.moreThan) {
                statement.push('>');
            } else if (filter.operator.moreThanEqual) {
                statement.push('>=');
            } else {
                statement.push('=');
            }

            let bindingKey : string | undefined = typeof options.bindingKeyFn === 'function' ?
                options.bindingKeyFn(fullKey) :
                undefined;

            if (typeof bindingKey === 'undefined') {
                bindingKey = `filter_${fullKey.replace('.', '_')}`;
            }

            if (filter.operator.in) {
                statement.push(`(:...${bindingKey})`);
            } else {
                statement.push(`:${bindingKey}`);
            }

            items.push({
                statement: statement.join(' '),
                binding: { [bindingKey]: filter.value },
            });
        }
    }

    return items;
}

/**
 * Apply transformed filter[s] parameter data on the db query.
 *
 * @param query
 * @param data
 */
export function applyFiltersTransformed<T>(
    query: SelectQueryBuilder<T>,
    data: FiltersTransformOutput,
) : FiltersTransformOutput {
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
export function applyQueryFiltersParseOutput<T>(
    query: SelectQueryBuilder<T>,
    data: FiltersParseOutput,
    options?: FiltersTransformOptions,
) : FiltersApplyOutput {
    applyFiltersTransformed(query, transformParsedFilters(data, options));

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
export function applyQueryFilters(
    query: SelectQueryBuilder<any> | undefined,
    data: unknown,
    options?: FiltersApplyOptions,
) : FiltersApplyOutput {
    options ??= {};

    const { transform: transformOptions, ...parseOptions } = options;

    return applyQueryFiltersParseOutput(
        query,
        parseQueryFilters(data, parseOptions),
        transformOptions,
    );
}

/**
 * Apply raw filter[s] parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyFilters(
    query: SelectQueryBuilder<any> | undefined,
    data: unknown,
    options?: FiltersApplyOptions,
) : FiltersApplyOutput {
    return applyQueryFilters(query, data, options);
}
