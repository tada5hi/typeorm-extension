import type { DataSource } from 'typeorm';

/**
 * The schema unqualified names resolve to (postgres: current_schema(),
 * mssql: the default schema of the login). typeorm reads it back after
 * connecting; drivers without schemas have none.
 */
export function readSearchSchema(dataSource: DataSource) : string | undefined {
    const { searchSchema } = dataSource.driver as { searchSchema?: unknown };

    if (typeof searchSchema === 'string' && searchSchema.length > 0) {
        return searchSchema;
    }

    return undefined;
}

/**
 * Remove the `"<schema>".` qualifier from a statement, so the object
 * resolves through the search path instead. String literals
 * (`DEFAULT '"public"."x"'`) and other quoted identifiers are kept as a
 * whole, as is a qualifier preceded by a dot: the middle part of a three
 * part name (`"db"."schema"."table"`).
 */
export function removeSchemaQualifier(statement: string, schema: string) : string {
    // RegExp.escape needs node 24, the package supports node 22
    const escaped = typeof RegExp.escape === 'function' ?
        RegExp.escape(schema) :
        // eslint-disable-next-line unicorn/prefer-regexp-escape
        schema.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const pattern = new RegExp(
        [
            // the qualifier, the only alternative which is removed
            `(?<!\\.)"${escaped}"\\.(?=")`,
            // a quoted identifier, "" is an escaped quote
            '"(?:[^"]|"")*"',
            // a string literal, '' is an escaped quote
            "'(?:[^']|'')*'",
        ].join('|'),
        'g',
    );

    return statement.replace(pattern, (match) => (match.startsWith(`"${schema}".`) ? '' : match));
}
