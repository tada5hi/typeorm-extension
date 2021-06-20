import {SelectQueryBuilder} from "typeorm";

export function applyRequestPagination(
    query: SelectQueryBuilder<any>,
    rawRequestPagination: unknown,
    maxLimit?: number
) {
    const pagination: {
        limit?: number,
        offset?: number
    } = {};

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
        if (typeof pagination.limit === 'undefined' || pagination.limit > maxLimit) {
            pagination.limit = maxLimit;
        }
    }

    if (typeof pagination.limit !== 'undefined') {
        query.take(pagination.limit);

        if (typeof pagination.offset === 'undefined') {
            query.skip(0);
        }
    }

    if (typeof pagination.offset !== 'undefined') {
        query.skip(pagination.offset);
    }

    return pagination;
}
