import type { QueryRunner } from 'typeorm';
import { withForeignKeyChecksDisabled } from './checks';
import { resolveSchemaDialect } from './dialect';
import {
    buildAddForeignKeyQuery,
    buildDropForeignKeyQuery,
    buildDropIndexQuery,
    buildRenameForeignKeyQuery,
    buildRenameIndexQuery,
} from './statements';
import type { SchemaRenameForeignKeyInput } from './type';
import { findTableForeignKey, findTableIndex } from './utils';

/**
 * mysql creates a backing index under the constraint name for a foreign key
 * column which carries no explicit index. That index survives the drop of the
 * constraint — it only becomes visible to the driver once the constraint is
 * gone, which is why the table has to be re-read here — and is dealt with
 * before the constraint is re-added, so the table can not end up with a stale
 * or duplicated index.
 *
 * Recent servers (verified on mysql 8/9 and mariadb 11) rename the index they
 * reuse for the new constraint themselves, which makes this a no-op in terms of
 * the end state. Doing it explicitly keeps the outcome independent of the
 * server version, and covers the case where the index can not be reused.
 */
async function alignForeignKeyBackingIndex(
    queryRunner: QueryRunner,
    input: SchemaRenameForeignKeyInput,
) : Promise<void> {
    const table = await queryRunner.getTable(input.table);
    if (!table || !findTableIndex(table, input.from)) {
        return;
    }

    if (findTableIndex(table, input.to)) {
        await queryRunner.query(buildDropIndexQuery('mysql', input.table, input.from));

        return;
    }

    await queryRunner.query(buildRenameIndexQuery('mysql', input));
}

/**
 * Rename a foreign key constraint, preserving its columns, its referenced
 * table/columns and its referential actions — all of which are read back from
 * the database, so the rename can not silently change the constraint.
 *
 * postgres renames the constraint in place, mysql has to drop and re-add it
 * (with the foreign key checks disabled, since the constraint was already
 * enforcing) and to take care of the backing index it may have created under
 * the constraint name.
 *
 * A no-op (returning false) if the table does not exist, a constraint is
 * already named `to`, or no constraint is named `from`.
 *
 * @throws DriverError for a driver which can not express the rename.
 */
export async function renameForeignKey(
    queryRunner: QueryRunner,
    input: SchemaRenameForeignKeyInput,
) : Promise<boolean> {
    const dialect = resolveSchemaDialect(queryRunner.dataSource.options.type);

    const table = await queryRunner.getTable(input.table);
    if (!table) {
        return false;
    }

    if (findTableForeignKey(table, input.to)) {
        return false;
    }

    const foreignKey = findTableForeignKey(table, input.from);
    if (!foreignKey) {
        return false;
    }

    if (dialect === 'postgres') {
        await queryRunner.query(buildRenameForeignKeyQuery(input));

        return true;
    }

    await withForeignKeyChecksDisabled(queryRunner, async () => {
        await queryRunner.query(buildDropForeignKeyQuery(dialect, input.table, input.from));

        await alignForeignKeyBackingIndex(queryRunner, input);

        await queryRunner.query(buildAddForeignKeyQuery(dialect, {
            table: input.table,
            name: input.to,
            columns: foreignKey.columnNames,
            referencedTable: foreignKey.referencedTableName,
            referencedColumns: foreignKey.referencedColumnNames,
            onDelete: foreignKey.onDelete,
            onUpdate: foreignKey.onUpdate,
        }));
    });

    return true;
}
