import {SelectQueryBuilder} from "typeorm";

/* istanbul ignore next */
export function existsQuery<T>(builder: SelectQueryBuilder<T>, inverse: boolean = false) {
    return (inverse ? 'not ' : '') + `exists (${builder.getQuery()})`;
}

export {
    applyParsedQueryFields,
    applyQueryFields,
} from './fields';

export {
    applyFiltersTransformed,
    applyParsedQueryFilters,
    applyQueryFilter,
} from './filters';

export {
    applyParsedQueryRelations,
    applyQueryRelations,
} from './relations';

export {
    applyParsedQueryPagination,
    applyQueryPagination,
} from './pagination';

export {
    applyParsedQuerySort,
    applyQuerySort
} from './sort';



