import type { QueryRunner } from 'typeorm';
import { resolveSchemaDialect } from './dialect';
import { buildRenameIndexQuery } from './statements';
import type { SchemaRenameIndexInput } from './type';
import { findTableIndex } from './utils';

/**
 * Rename an index.
 *
 * A no-op (returning false) if the table does not exist, an index is already
 * named `to`, or no index is named `from` — a repair migration must stay
 * resumable, since mysql commits DDL regardless of the surrounding transaction.
 *
 * Note that an index which backs a constraint is not reported as an index by
 * the driver: a unique constraint on postgres lives in `table.uniques`, and a
 * foreign key's backing index on mysql only becomes visible once the constraint
 * is dropped (see renameForeignKey).
 *
 * @throws DriverError for a driver which can not express the rename.
 */
export async function renameIndex(
    queryRunner: QueryRunner,
    input: SchemaRenameIndexInput,
) : Promise<boolean> {
    const dialect = resolveSchemaDialect(queryRunner.dataSource.options.type);

    const table = await queryRunner.getTable(input.table);
    if (!table) {
        return false;
    }

    if (
        findTableIndex(table, input.to) ||
        !findTableIndex(table, input.from)
    ) {
        return false;
    }

    await queryRunner.query(buildRenameIndexQuery(dialect, input));

    return true;
}
