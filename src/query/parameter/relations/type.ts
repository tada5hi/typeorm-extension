import { RelationsParseOptions, RelationsParseOutput } from 'rapiq';
import { ObjectLiteral } from 'typeorm';

export type QueryRelationsApplyOptions<T extends ObjectLiteral = ObjectLiteral> = RelationsParseOptions<T> & {
    defaultAlias?: string
};
export type QueryRelationsApplyOutput = RelationsParseOutput;
