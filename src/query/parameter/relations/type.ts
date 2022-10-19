import { RelationsParseOptions, RelationsParseOutput } from 'rapiq';
import { ObjectLiteral } from 'typeorm';

export type RelationsApplyOptions<T extends ObjectLiteral = ObjectLiteral> = RelationsParseOptions<T> & {
    defaultAlias?: string
};
export type RelationsApplyOutput = RelationsParseOutput;

export {
    RelationsParseOptions,
    RelationsParseOutput,
};
