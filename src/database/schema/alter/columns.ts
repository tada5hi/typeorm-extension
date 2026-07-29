import type { QueryRunner } from 'typeorm';
import type { SchemaChangeColumnTypeInput } from './type';
import { matchesColumnType, normalizeColumnLength } from './utils';

/**
 * Change the type (and optionally the nullability) of a column, but only if it
 * still matches the `from` description.
 *
 * A no-op (returning false) if the table/column does not exist, the column
 * already matches `to`, or it matches neither — which keeps a repair migration
 * resumable and safe to run against a database which never had the drift.
 *
 * Unlike the rename helpers this works on every driver, since the statements
 * are built by typeorm itself.
 */
export async function changeColumnType(
    queryRunner: QueryRunner,
    input: SchemaChangeColumnTypeInput,
) : Promise<boolean> {
    const table = await queryRunner.getTable(input.table);
    if (!table) {
        return false;
    }

    const column = table.findColumnByName(input.column);
    if (!column) {
        return false;
    }

    const { driver } = queryRunner.dataSource;
    const normalizeType = (type: string) => driver.normalizeType({ type: type as any });

    if (
        matchesColumnType(column, input.to, normalizeType) ||
        !matchesColumnType(column, input.from, normalizeType)
    ) {
        return false;
    }

    const next = column.clone();
    next.type = normalizeType(input.to.type);

    if (typeof input.to.length !== 'undefined') {
        next.length = normalizeColumnLength(input.to.length);
    } else if (next.type.toLowerCase() !== normalizeType(column.type).toLowerCase()) {
        // the type changed and no length was asked for, so the current one
        // does not carry over (varchar(255) -> text, not text(255))
        next.length = '';
    }
    // same type without a length: keep the current one — a nullability-only
    // repair must not silently widen varchar(255) to varchar

    if (typeof input.to.nullable === 'boolean') {
        next.isNullable = input.to.nullable;
    }

    await queryRunner.changeColumn(table, column, next);

    return true;
}
