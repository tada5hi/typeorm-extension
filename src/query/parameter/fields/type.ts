import { FieldsParseOptions, FieldsParseOutput } from 'rapiq';
import { ObjectLiteral } from 'typeorm';

export type QueryFieldsApplyOptions<
    T extends ObjectLiteral = ObjectLiteral,
    > = FieldsParseOptions<T> & {
        defaultAlias?: string
    };
export type QueryFieldsApplyOutput = FieldsParseOutput;
