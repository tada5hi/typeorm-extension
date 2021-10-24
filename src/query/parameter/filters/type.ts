import {FiltersParseOptions, FiltersParseOutput} from "@trapi/query";

export type FiltersApplyOptions = FiltersParseOptions & {
    transform?: FiltersTransformOptions
};

export type FiltersApplyOutput = FiltersParseOutput;

export {
    FiltersParseOptions,
    FiltersParseOutput
};

// -----------------------------------------

export type FiltersTransformOptions = {
    bindingKeyFn?: (key: string) => string,
};

export type FilterTransformOutputElement = {
    statement: string,
    binding: Record<string, any>
};
export type FiltersTransformOutput = FilterTransformOutputElement[];
