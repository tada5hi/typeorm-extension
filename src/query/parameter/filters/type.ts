import { FiltersParseOptions, FiltersParseOutput } from 'rapiq';
import { ObjectLiteral } from 'typeorm';

export type FiltersApplyOptions<
    T extends ObjectLiteral = ObjectLiteral,
    > = FiltersParseOptions<T> & {
        bindingKey?: (key: string) => string,
        defaultAlias?: string
    };

export type FiltersApplyOutput = FiltersParseOutput;

export {
    FiltersParseOptions,
    FiltersParseOutput,
};

// -----------------------------------------

export type FilterTransformOutputElement = {
    statement: string,
    binding: Record<string, any>
};
export type FiltersTransformOutput = FilterTransformOutputElement[];
