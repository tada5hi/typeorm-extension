import type { QueryRunner } from 'typeorm';
import { OptionsError } from '../../../errors';
import { withForeignKeyChecksDisabled } from './checks';
import { resolveSchemaDialect } from './dialect';
import {
    buildAddForeignKeyQuery,
    buildDropForeignKeyQuery,
    buildDropIndexQuery,
    buildRenameForeignKeyQuery,
    buildRenameIndexQuery,
} from './statements';
import type {
    SchemaAddForeignKeyInput,
    SchemaDialect,
    SchemaRenameForeignKeyInput,
} from './type';
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
 * The caller supplied constraint definition, if it is complete.
 *
 * @throws OptionsError for a partially supplied definition — silently ignoring
 * half of it would turn a typo into a missing constraint.
 */
function buildForeignKeyDefinition(
    input: SchemaRenameForeignKeyInput,
) : SchemaAddForeignKeyInput | undefined {
    const parts = [
        input.columns && input.columns.length > 0,
        !!input.referencedTable,
        input.referencedColumns && input.referencedColumns.length > 0,
    ];

    if (parts.every((part) => !part)) {
        return undefined;
    }

    if (!parts.every((part) => !!part)) {
        throw new OptionsError(
            'The foreign key definition is incomplete: columns, referencedTable and referencedColumns must be provided together.',
        );
    }

    return {
        table: input.table,
        name: input.to,
        columns: input.columns as string[],
        referencedTable: input.referencedTable as string,
        referencedColumns: input.referencedColumns as string[],
        onDelete: input.onDelete,
        onUpdate: input.onUpdate,
    };
}

/**
 * Neither name is present. On mysql that is what a run interrupted between the
 * drop and the re-add leaves behind, and the definition is gone with the
 * constraint — so it can only be restored from the caller supplied one.
 */
async function recreateForeignKey(
    queryRunner: QueryRunner,
    dialect: SchemaDialect,
    input: SchemaRenameForeignKeyInput,
) : Promise<boolean> {
    const definition = buildForeignKeyDefinition(input);
    if (!definition) {
        return false;
    }

    await withForeignKeyChecksDisabled(queryRunner, async () => {
        if (dialect === 'mysql') {
            await alignForeignKeyBackingIndex(queryRunner, input);
        }

        await queryRunner.query(buildAddForeignKeyQuery(dialect, definition));
    });

    return true;
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
 * A no-op (returning false) if the table does not exist or a constraint is
 * already named `to`. If neither name exists — the state an interrupted mysql
 * rename leaves behind, where the definition is gone with the constraint — the
 * caller supplied definition is used to restore it; without one this stays a
 * no-op.
 *
 * @throws DriverError for a driver which can not express the rename.
 * @throws OptionsError for a partially supplied constraint definition.
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
        return recreateForeignKey(queryRunner, dialect, input);
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
