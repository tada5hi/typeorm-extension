import { SortParseOptions, SortParseOutput } from 'rapiq';
import { ObjectLiteral } from 'typeorm';

export type QuerySortApplyOptions<T extends ObjectLiteral = ObjectLiteral> = SortParseOptions<T> & {
    defaultAlias?: string
};
export type QuerySortApplyOutput = SortParseOutput;
