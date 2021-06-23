import {SelectQueryBuilder} from "typeorm";

/* istanbul ignore next */
export const existsQuery = <T>(builder: SelectQueryBuilder<T>, inverse: boolean = false) => (inverse ? 'not ' : '') + `exists (${builder.getQuery()})`;

export * from './utils';
export {
    applyRequestFilter,
    applyRequestFilters
} from './filters';
export {
    applyRequestIncludes
} from './includes';
export * from './pagination';
export {
    applyRequestFields
} from './fields';
