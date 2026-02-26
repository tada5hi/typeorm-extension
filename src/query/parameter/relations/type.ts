import type { RelationsParseOptions, RelationsParseOutput } from 'rapiq';
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export type QueryRelationsOnJoinFn<T extends ObjectLiteral = ObjectLiteral> = (property: string, alias: string, query: SelectQueryBuilder<T>) => void;

export type QueryRelationsApplyOptions<T extends ObjectLiteral = ObjectLiteral> = RelationsParseOptions<T> & {
    defaultAlias?: string,
    onJoin?: QueryRelationsOnJoinFn<T>
};
export type QueryRelationsApplyOutput = RelationsParseOutput;
