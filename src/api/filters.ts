import {FiltersParsed, FiltersParsedElement, FiltersParseOptions, parseFilters} from "@trapi/query";
import {Brackets, SelectQueryBuilder} from "typeorm";

// --------------------------------------------------

export type FiltersTransformOptions = {
    bindingKeyFn?: (key: string) => string,
};

export type FilterTransformed = {
    statement: string,
    binding: Record<string, any>
};

export type FiltersTransformed = FilterTransformed[];

// --------------------------------------------------

export function transformParsedFilters(
    data: FiltersParsed,
    options?: FiltersTransformOptions
) : FiltersTransformed {
    options ??= {};

    const items : FiltersTransformed = [];

    for (const key in data) {
        const fullKey : string = (!!data[key].alias ? `${data[key].alias}.` : '') + data[key].key;

        let bindingKey : string | undefined = typeof options.bindingKeyFn === 'function' ? options.bindingKeyFn(data[key].key) : undefined;
        if(typeof bindingKey === 'undefined') {
            bindingKey = `filter_${fullKey.replace('.', '_')}`;
        }

        const queryParts : string[] = [
            fullKey
        ];

        let value = data[key].value;

        const filter : FiltersParsedElement = data[key];
        filter.operator ??= {};

        if(
            (
                typeof value === 'string' ||
                typeof value === 'number'
            ) &&
            filter.operator.like
        ) {
            value += '%';
        }

        if(filter.operator.in || filter.operator.like) {
            if(filter.operator.negation) {
                queryParts.push('NOT');
            }

            if(filter.operator.like) {
                queryParts.push('LIKE');
            } else if(filter.operator.in) {
                queryParts.push('IN');
            }
        } else {
            if(filter.operator.negation) {
                queryParts.push('!=');
            } else {
                queryParts.push("=");
            }
        }

        if (filter.operator.in) {
            queryParts.push('(:...' + bindingKey + ')');
        } else {
            queryParts.push(':' + bindingKey);
        }



        items.push({
            statement: queryParts.join(" "),
            binding: {[bindingKey]: value}
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
export function applyFiltersTransformed<T>(
    query: SelectQueryBuilder<T>,
    data: FiltersTransformed,
) {
    if(data.length === 0) {
        return data;
    }

    /* istanbul ignore next */
    query.andWhere(new Brackets(qb => {
        for (let i = 0; i < data.length; i++) {
            if(i === 0) {
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
export function applyParsedQueryFilters<T>(
    query: SelectQueryBuilder<T>,
    data: FiltersParsed,
    options?: FiltersTransformOptions
) : FiltersTransformed {
    return applyFiltersTransformed(query, transformParsedFilters(data, options));
}

// --------------------------------------------------

/**
 * Apply raw filter[s] parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyQueryFilter(
    query: SelectQueryBuilder<any> | undefined,
    data: unknown,
    options?: {
        parse?: FiltersParseOptions,
        transform?: FiltersTransformOptions
    }
) : FiltersTransformed  {
    options ??= {};
    options.parse ??= {};
    options.transform ??= {};

    return applyParsedQueryFilters(
        query,
        parseFilters(data, options.parse),
        options.transform
    );
}
