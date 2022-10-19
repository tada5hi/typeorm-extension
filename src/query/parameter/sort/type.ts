import { SortParseOptions, SortParseOutput } from 'rapiq';
import { ObjectLiteral } from 'typeorm';

export type SortApplyOptions<T extends ObjectLiteral = ObjectLiteral> = SortParseOptions & {
    defaultAlias?: string
};
export type SortApplyOutput = SortParseOutput;

export {
    SortParseOptions,
    SortParseOutput,
};
