import {IncludesTransformed} from "../includes";
import {FieldDetails, getFieldDetails} from "./field";

export function isFieldAllowedByIncludes(
    field: string | FieldDetails,
    includes?: IncludesTransformed,
    options?: {queryAlias?: string}
) : boolean {
    if(typeof includes === 'undefined') {
        return true;
    }

    options = options ?? {};

    const details : FieldDetails = typeof field === 'string' ? getFieldDetails(field) : field;

    // check if field is associated to the default domain.
    if(
        typeof details.path === 'undefined' &&
        typeof details.alias === 'undefined'
    ) {
        return true;
    }

    // check if field is associated to the default domain.
    if(
        details.path === options.queryAlias ||
        details.alias === options.queryAlias
    ) {
        return true;
    }

    return includes.filter(include => include.alias === details.path || include.alias === details.alias).length > 0;
}

export function buildFieldWithQueryAlias(
    field: string | FieldDetails,
    queryAlias?: string
) : string {

    const details : FieldDetails = typeof field === 'string' ? getFieldDetails(field) : field;

    if(
        typeof details.path === 'undefined' &&
        typeof details.alias === 'undefined'
    ) {
        // try to use query alias
        return queryAlias ? queryAlias + '.' + details.name : details.name;
    }

    return details.alias + '.' + details.name;
}
