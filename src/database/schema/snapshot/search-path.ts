import type { QueryRunner } from 'typeorm';

/**
 * Run `fn` with the postgres / cockroachdb `search_path` set to the target schema alone
 * (`options.schema`, else the current schema), and restore the previous value afterwards.
 *
 * Postgres qualifies a type, function or table outside the search path in every definition
 * it prints (`'b'::app.status`, `app.norm(...)`), so the same DDL in two schemas would read
 * differently. Other drivers run `fn` as is.
 *
 * When `fn` fails, a failing restore is swallowed so the read error surfaces (a transaction
 * of the caller may be aborted by then, and its rollback reverts the setting anyway).
 * Otherwise a restore failure propagates.
 */
export async function withSchemaSearchPath<T>(
    queryRunner: QueryRunner,
    fn: () => Promise<T>,
): Promise<T> {
    const { options } = queryRunner.connection;

    if (options.type !== 'postgres' && options.type !== 'cockroachdb') {
        return fn();
    }

    const [{ search_path: previous }] = await queryRunner.query('SHOW search_path') as { search_path: string }[];

    let { schema } = options as { schema?: string };

    if (!schema) {
        const [row] = await queryRunner.query('SELECT current_schema() AS "schema"') as { schema: string | null }[];

        schema = row?.schema ?? undefined;
    }

    if (!schema) {
        return fn();
    }

    const set = (value: string, quote: boolean) => queryRunner.query(
        `SELECT set_config('search_path', ${quote ? 'quote_ident($1)' : '$1'}, false)`,
        [value],
    );

    await set(schema, true);

    let result: T;

    try {
        result = await fn();
    } catch (error) {
        try {
            await set(previous, false);
        } catch {
            // keep the read error
        }

        throw error;
    }

    await set(previous, false);

    return result;
}
