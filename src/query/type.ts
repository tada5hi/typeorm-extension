import type { ParseOptions, ParseOutput } from 'rapiq';
import type { ObjectLiteral } from 'typeorm';

export type QueryApplyOptions<
    T extends ObjectLiteral = ObjectLiteral,
    > = ParseOptions<T> & {
        defaultAlias?: string
    };

export type QueryApplyOutput = ParseOutput & {
    defaultAlias?: string
};
