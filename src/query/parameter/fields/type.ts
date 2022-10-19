import { FieldsParseOptions, FieldsParseOutput } from 'rapiq';
import { ObjectLiteral } from 'typeorm';

export type FieldsApplyOptions<
    T extends ObjectLiteral = ObjectLiteral,
    > = FieldsParseOptions<T> & {
        defaultAlias?: string
    };
export type FieldsApplyOutput = FieldsParseOutput;

export {
    FieldsParseOptions,
    FieldsParseOutput,
};
