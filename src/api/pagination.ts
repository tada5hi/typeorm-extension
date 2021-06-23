import {SelectQueryBuilder} from "typeorm";

type PaginationResult = {
    limit?: number,
    offset?: number
}
export function applyRequestPagination(
    query: SelectQueryBuilder<any>,
    rawRequestPagination: unknown,
    maxLimit?: number
) : PaginationResult {
    const pagination: PaginationResult = {};

    const prototype: string = Object.prototype.toString.call(rawRequestPagination as any);
    if (prototype === '[object Object]') {
        const rawPagination: Record<string, any> = rawRequestPagination;

        if (rawPagination.hasOwnProperty('limit')) {
            // tslint:disable-next-line:radix
            const limit: number = parseInt(rawPagination.limit);

            if (!Number.isNaN(limit) && limit > 0) {
                pagination.limit = limit;
            }
        }

        if (rawPagination.hasOwnProperty('offset')) {
            // tslint:disable-next-line:radix
            const offset: number = parseInt(rawPagination.offset);

            if (!Number.isNaN(offset) && offset >= 0) {
                pagination.offset = offset;
            }
        }
    }

    if (typeof maxLimit !== 'undefined') {
        if (
            typeof pagination.limit === 'undefined' ||
            pagination.limit > maxLimit
        ) {
            pagination.limit = maxLimit;
        } else {
            pagination.limit = maxLimit;
        }
    }

    if(
        typeof pagination.limit !== 'undefined' &&
        typeof pagination.offset === 'undefined'
    ) {
        pagination.offset = 0;
    }

    /* istanbul ignore next */
    if (typeof pagination.limit !== 'undefined') {
        query.take(pagination.limit);

        if (typeof pagination.offset === 'undefined') {
            query.skip(0);
        }
    }

    /* istanbul ignore next */
    if (typeof pagination.offset !== 'undefined') {
        query.skip(pagination.offset);
    }

    return pagination;
}
