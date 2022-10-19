import { FiltersParseOutput, parseQueryFilters } from 'rapiq';

import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { buildKeyWithPrefix, getAliasForPath } from '../../utils';
import {
    FiltersApplyOptions, FiltersApplyOutput, FiltersTransformOutput,
} from './type';

// --------------------------------------------------

export function transformParsedFilters(
    data: FiltersParseOutput,
    options: FiltersApplyOptions,
) : FiltersTransformOutput {
    options = options || {};

    const items : FiltersTransformOutput = [];

    for (let i = 0; i < data.length; i++) {
        const alias = getAliasForPath(options.relations, data[i].path) ||
            options.defaultAlias;

        const fullKey : string = buildKeyWithPrefix(data[i].key, alias);

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

            let bindingKey : string | undefined = typeof options.bindingKey === 'function' ?
                options.bindingKey(fullKey) :
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
export function applyFiltersTransformed<T extends ObjectLiteral = ObjectLiteral>(
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
export function applyQueryFiltersParseOutput<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: FiltersParseOutput,
    options?: FiltersApplyOptions<T>,
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
export function applyQueryFilters<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T> | undefined,
    data: unknown,
    options?: FiltersApplyOptions<T>,
) : FiltersApplyOutput {
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
    query: SelectQueryBuilder<T> | undefined,
    data: unknown,
    options?: FiltersApplyOptions<T>,
) : FiltersApplyOutput {
    return applyQueryFilters(query, data, options);
}
