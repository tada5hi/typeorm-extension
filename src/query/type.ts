import type { ParseOutput } from 'rapiq';
import type { ObjectLiteral } from 'typeorm';
import type {
    QueryFieldsApplyOptions,
    QueryFiltersApplyOptions,
    QueryPaginationApplyOptions,
    QueryRelationsApplyOptions,
    QuerySortApplyOptions,
} from './parameter';

export type QueryApplyOptions<
    T extends ObjectLiteral = ObjectLiteral,
    > = {
        defaultPath?: string;
        throwOnFailure?: boolean;
        defaultAlias?: string,

        fields?: boolean | QueryFieldsApplyOptions<T>,
        filters?: boolean | QueryFiltersApplyOptions<T>,
        pagination?: boolean | QueryPaginationApplyOptions,
        relations?: boolean | QueryRelationsApplyOptions<T>,
        sort?: boolean | QuerySortApplyOptions<T>
    };

export type QueryApplyOutput = ParseOutput & {
    defaultAlias?: string
};
