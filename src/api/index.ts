import {SelectQueryBuilder} from "typeorm";

/* istanbul ignore next */
export const existsQuery = <T>(builder: SelectQueryBuilder<T>, inverse: boolean = false) => (inverse ? 'not ' : '') + `exists (${builder.getQuery()})`;

export {
    transformFields,
    applyFieldsTransformed,
    applyFields,
    applyRequestFields
} from './fields';

export {
    transformFilters,
    applyFiltersTransformed,
    applyFilters,
    applyRequestFilter,
    applyRequestFilters
} from './filters';

export {
    transformIncludes,
    applyIncludesTransformed,
    applyIncludes,
    applyRequestIncludes
} from './includes';

export {
    transformPagination,
    applyPaginationTransformed,
    applyPagination,
    applyRequestPagination
} from './pagination';

export {
    transformSort,
    applySortTransformed,
    applySort
} from './sort';

export {
    setDefaultStringCase,
    getDefaultStringCase,
    setDefaultRequestKeyCase,
    getDefaultRequestKeyCase
} from './utils';



