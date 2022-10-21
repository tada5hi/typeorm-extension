import { FiltersParseOptions, FiltersParseOutput } from 'rapiq';
import { ObjectLiteral } from 'typeorm';

export type QueryFiltersApplyOptions<
    T extends ObjectLiteral = ObjectLiteral,
    > = FiltersParseOptions<T> & {
        bindingKey?: (key: string) => string,
        defaultAlias?: string
    };

export type QueryFiltersApplyOutput = FiltersParseOutput;

// -----------------------------------------

export type QueryFiltersOutputElement = {
    statement: string,
    binding: Record<string, any>
};
export type QueryFiltersOutput = QueryFiltersOutputElement[];
