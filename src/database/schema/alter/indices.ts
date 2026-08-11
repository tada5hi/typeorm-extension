import type { QueryRunner } from 'typeorm';
import { SchemaAlterationError } from '../../../errors';
import { resolveSchemaDialect } from './dialect';
import { buildRenameIndexQuery } from './statements';
import type { SchemaRenameIndexInput } from './type';
import { findTableIndex, isStrict } from './utils';

/**
 * Rename an index.
 *
 * Returns false when an index is already named `to` — that is what keeps a
 * repair migration resumable, since mysql commits DDL regardless of the
 * surrounding transaction.
 *
 * When neither name is present (or the table is missing) the database is not
 * in a state this can act on, and `strict` (the default) raises a
 * `SchemaAlterationError` rather than reporting a repair which did not happen.
 *
 * Note that an index which backs a constraint is not reported as an index by
 * the driver: a unique constraint on postgres lives in `table.uniques`, and a
 * foreign key's backing index on mysql only becomes visible once the constraint
 * is dropped (see renameForeignKey).
 *
 * @throws DriverError for a driver which can not express the rename.
 * @throws SchemaAlterationError if neither name exists and `strict`.
 */
export async function renameIndex(
    queryRunner: QueryRunner,
    input: SchemaRenameIndexInput,
) : Promise<boolean> {
    const dialect = resolveSchemaDialect(queryRunner.dataSource.options.type);

    const table = await queryRunner.getTable(input.table);
    if (!table) {
        if (isStrict(input)) {
            throw SchemaAlterationError.tableNotFound(input.table);
        }

        return false;
    }

    // already renamed
    if (findTableIndex(table, input.to)) {
        return false;
    }

    if (!findTableIndex(table, input.from)) {
        if (isStrict(input)) {
            throw SchemaAlterationError.indexNotFound(input.table, input.from);
        }

        return false;
    }

    await queryRunner.query(buildRenameIndexQuery(dialect, input));

    return true;
}
