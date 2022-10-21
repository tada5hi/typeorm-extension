import { ParseOptions, ParseOutput } from 'rapiq';
import { ObjectLiteral } from 'typeorm';

export type QueryApplyOptions<
    T extends ObjectLiteral = ObjectLiteral,
    > = ParseOptions<T> & {
        defaultAlias?: string
    };

export type QueryApplyOutput = ParseOutput & {
    defaultAlias?: string
};
