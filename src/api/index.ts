import {SelectQueryBuilder} from "typeorm";

export const existsQuery = <T>(builder: SelectQueryBuilder<T>, inverse: boolean = false) => (inverse ? 'not ' : '') + `exists (${builder.getQuery()})`;

export * from './filter';
export * from './include';
export * from './pagination';
export * from './fields';
