import type { Driver, QueryRunner, TableColumn } from 'typeorm';
import { DriverError, SchemaAlterationError } from '../../../errors';
import { findSchemaColumnDialect } from './dialect';
import { buildChangeColumnTypeQueries } from './statements';
import type { SchemaChangeColumnTypeInput, SchemaColumnDefinition } from './type';
import type { SchemaColumnDescriber } from './utils';
import { isStrict, matchesColumnType, normalizeColumnLength } from './utils';

/**
 * Describe the column as the database reports it, so a dialect which replaces
 * the definition in full can restate every attribute it carries (default,
 * comment, charset, AUTO_INCREMENT, …) instead of dropping it.
 *
 * The primary key is deliberately left out: the column already carries it,
 * and repeating it would be a second one. mysql's `ZEROFILL` is missing for a
 * different reason — typeorm does not read it into `TableColumn` at all, so a
 * zerofill column loses the attribute (it is a display width mysql deprecated
 * in 8.0.17, and typeorm's own statements drop it just the same).
 */
function buildColumnDefinition(driver: Driver, column: TableColumn) : SchemaColumnDefinition {
    return {
        name: column.name,
        type: driver.createFullType(column),
        // a generated column takes its nullability from its expression,
        // and mariadb rejects the clause on one outright
        nullable: column.asExpression ? undefined : column.isNullable,
        enum: column.enum,
        unsigned: column.unsigned,
        charset: column.charset,
        collation: column.collation,
        asExpression: column.asExpression,
        generatedType: column.generatedType,
        default: column.default,
        onUpdate: column.onUpdate,
        autoIncrement: column.isGenerated && column.generationStrategy === 'increment',
        comment: column.comment,
    };
}

/**
 * Change the type (and optionally the nullability) of a column, but only if it
 * still matches the `from` description.
 *
 * Returns false when the column already matches `to`, which keeps a repair
 * migration resumable and safe to run against a database which never had the
 * drift. When the column matches neither description (or is missing) the
 * database is not in a state this can act on, and `strict` (the default)
 * raises a `SchemaAlterationError` rather than reporting a repair which did
 * not happen.
 *
 * The column is altered in place, so it keeps the values it holds. That is the
 * reason the statement is built here: typeorm's `changeColumn` drops and
 * re-adds the column as soon as the type or the length differs, which empties
 * it. Drivers this module has no dialect for still go through typeorm — safe
 * on sqlite, which recreates the table and copies the values over.
 *
 * Widening a column a foreign key depends on additionally needs
 * {@see withForeignKeyChecksDisabled} on mysql, and is refused outright by
 * mariadb — there the constraint has to be dropped around the change.
 *
 * postgres converts the values with the assignment cast between the two types
 * and refuses a change which has none; pass `using` to describe the conversion
 * for those.
 *
 * @throws SchemaAlterationError if the column matches neither description and
 *         `strict`.
 */
export async function changeColumnType(
    queryRunner: QueryRunner,
    input: SchemaChangeColumnTypeInput,
) : Promise<boolean> {
    const table = await queryRunner.getTable(input.table);
    if (!table) {
        if (isStrict(input)) {
            throw SchemaAlterationError.tableNotFound(input.table);
        }

        return false;
    }

    const column = table.findColumnByName(input.column);
    if (!column) {
        if (isStrict(input)) {
            throw SchemaAlterationError.columnNotFound(input.table, input.column);
        }

        return false;
    }

    const { driver } = queryRunner.dataSource;
    const normalizeType = (type: string) => driver.normalizeType({ type });
    const describer : SchemaColumnDescriber = {
        normalizeType,
        describeType: (type, length) => {
            const probe = column.clone();
            probe.type = normalizeType(type);
            probe.length = normalizeColumnLength(length);

            return driver.createFullType(probe);
        },
    };

    // already applied
    if (matchesColumnType(column, input.to, describer)) {
        return false;
    }

    if (!matchesColumnType(column, input.from, describer)) {
        if (isStrict(input)) {
            throw SchemaAlterationError.columnMismatch(input.table, input.column);
        }

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

    const { type } = queryRunner.dataSource.options;
    const dialect = findSchemaColumnDialect(type);

    if (input.using && dialect !== 'postgres') {
        // ignoring it would leave the server to coerce the values its own way,
        // which is exactly what the expression was passed to prevent
        throw DriverError.columnConversionExpressionNotSupported(type);
    }

    if (!dialect) {
        await queryRunner.changeColumn(table, column, next);

        return true;
    }

    const queries = buildChangeColumnTypeQueries(
        dialect,
        input.table,
        {
            ...buildColumnDefinition(driver, next),
            nullabilityChanged: next.isNullable !== column.isNullable,
            using: input.using,
        },
    );

    for (const query of queries) {
        await queryRunner.query(query);
    }

    return true;
}
