import type {
    DataSource,
    DataSourceOptions,
    QueryRunner,
    Table,
    TableColumn,
} from 'typeorm';
import { InstanceChecker } from 'typeorm';
import { DriverError } from '../../../errors/driver';
import { SchemaSnapshotError } from '../../../errors/schema-snapshot';
import { useInitializedDataSource } from '../utils';
import { buildUserTablesStatement, readUserTableNames } from '../migration/tables';
import { named } from './native/catalogue';
import { readNativeColumns } from './native/columns';
import { readNativeComments } from './native/comments';
import { readNativeConstraints, readsConstraintParts } from './native/constraints';
import { readNativeIndices } from './native/indices';
import { readNativeKeys } from './native/keys';
import { readOwnSchema, unqualifyTable } from './native/qualifier';
import { readNativeTables } from './native/tables';
import type {
    NativeColumn,
    NativeComments,
    NativeConstraints,
    NativeKeys,
} from './native/types';
import { withSchemaSearchPath } from './search-path';
import type {
    SchemaSnapshot,
    SchemaSnapshotColumn,
    SchemaSnapshotIndex,
    SchemaSnapshotOptions,
    SchemaSnapshotTable,
    SchemaSnapshotView,
} from './types';

function unqualify(name: string): string {
    const index = name.lastIndexOf('.');

    return index === -1 ? name : name.slice(index + 1);
}

/**
 * The catalogue name a typeorm table name stands for: the name itself when listed, else the longest
 * listed name it ends in after a qualifier (`app.item` -> `item`), else the part after the last dot.
 */
function resolveName(name: string, listed: string[]): string {
    if (listed.includes(name)) {
        return name;
    }

    let match: string | undefined;

    for (const candidate of listed) {
        if (name.endsWith(`.${candidate}`) && (!match || candidate.length > match.length)) {
            match = candidate;
        }
    }

    return match ?? unqualify(name);
}

function compare(a: string | undefined, b: string | undefined): number {
    const left = a ?? '';
    const right = b ?? '';

    if (left < right) {
        return -1;
    }

    return left > right ? 1 : 0;
}

function byNameThenColumns<T extends { name?: string, columns: string[] }>(a: T, b: T): number {
    return compare(a.name, b.name) || compare(a.columns.join(','), b.columns.join(','));
}

function toColumn(column: TableColumn): SchemaSnapshotColumn {
    return {
        name: column.name,
        type: column.type,
        length: column.length || null,
        precision: column.precision ?? null,
        scale: column.scale ?? null,
        isNullable: !!column.isNullable,
        default: column.default === undefined || column.default === null ? null : String(column.default),
        isGenerated: !!column.isGenerated,
        generationStrategy: column.generationStrategy ?? null,
        generatedType: column.generatedType ?? null,
        asExpression: column.asExpression ?? null,
        charset: column.charset ?? null,
        collation: column.collation ?? null,
        isUnsigned: !!column.unsigned,
        enum: column.enum ? [...column.enum].sort() : null,
        enumName: column.enumName ?? null,
        isArray: !!column.isArray,
        generatedIdentity: column.generatedIdentity ?? null,
        // sqlite reports '' and mysql may: no comment either way
        comment: column.comment || null,
        onUpdate: column.onUpdate || null,
        spatialFeatureType: column.spatialFeatureType || null,
        srid: column.srid ?? null,
        options: null,
    };
}

/**
 * Key columns in key order where the driver has a native key reader, sorted otherwise:
 * typeorm reports them in table column order, which says nothing about the key.
 */
function keyColumns(columns: string[], native?: { columns: string[] }): string[] {
    return native ? [...native.columns] : [...columns].sort();
}

type NativeTable = {
    indices?: SchemaSnapshotIndex[],
    keys?: NativeKeys,
    constraints?: NativeConstraints,
    constraintParts: (keyof NativeConstraints)[],
    comments?: NativeComments,
    columns?: Map<string, NativeColumn>,
    options?: string | null,
};

/**
 * The column with what the catalogue reads in place of typeorm's values.
 */
function withNativeColumn(column: SchemaSnapshotColumn, native: NativeColumn): SchemaSnapshotColumn {
    return {
        ...column,
        asExpression: native.expression,
        generatedType: native.generatedType,
        ...(native.identity !== undefined ? { generatedIdentity: native.identity } : {}),
        ...(native.onUpdate !== undefined ? { onUpdate: native.onUpdate } : {}),
        default: native.defaultOnNull && column.default !== null ? `ON NULL ${column.default}` : column.default,
        options: native.options,
    };
}

/**
 * Throw unless typeorm read the columns the catalogue lists: a column typeorm skips (a cockroachdb
 * NOT VISIBLE column) would otherwise go unnoticed. Better-sqlite3 has no catalogue expression of a
 * generated column (typeorm reads it from its metadata table), so such a table is refused.
 */
function assertColumnsRead(type: DataSourceOptions['type'], name: string, columns: string[], native: Map<string, NativeColumn>) {
    if (type === 'better-sqlite3') {
        const generated = [...native].filter(([, column]) => column.generatedType).map(([column]) => column);

        if (generated.length > 0) {
            throw SchemaSnapshotError.generatedColumnsNotSupported(name, generated);
        }
    }

    const missing = native.keys().toArray().filter((column) => !native.get(column)?.system && !columns.includes(column));
    const extra = columns.filter((column) => !native.has(column));

    if (missing.length > 0 || extra.length > 0) {
        throw SchemaSnapshotError.columnsNotRead(type, name, missing, extra);
    }
}

function toTable(
    table: Table,
    listed: string[],
    native: NativeTable,
): SchemaSnapshotTable {
    const {
        indices: nativeIndices,
        keys,
        constraints,
        comments,
    } = native;
    const primary = table.columns.filter((column) => column.isPrimary);
    const primaryName = primary.find((column) => column.primaryKeyConstraintName)?.primaryKeyConstraintName;
    const definition = (name?: string) => (name ? keys?.definitions.get(name) ?? null : null);

    const snapshot: SchemaSnapshotTable = {
        name: resolveName(table.name, listed),
        comment: table.comment || null,
        options: null,
        columns: table.columns.map(toColumn).sort((a, b) => compare(a.name, b.name)),
        primaryKey: primary.length > 0 ?
            named(primaryName, {
                columns: keyColumns(primary.map((column) => column.name), keys?.primary),
                deferrable: keys?.primary?.deferrable ?? null,
                definition: definition(primaryName ?? keys?.primary?.name),
            }) :
            null,
        indices: nativeIndices ? [...nativeIndices].sort(byNameThenColumns) : table.indices.map((index) => named(index.name, {
            columns: [...index.columnNames],
            isUnique: !!index.isUnique,
            where: index.where || null,
            kind: (index.isSpatial && 'spatial' as const) || (index.isFulltext && 'fulltext' as const) || null,
            definition: null,
        })).sort(byNameThenColumns),
        uniques: table.uniques.map((unique) => {
            const key = unique.name ? keys?.uniques.get(unique.name) : undefined;

            return named(unique.name, {
                columns: keyColumns(unique.columnNames, key),
                deferrable: key?.deferrable ?? unique.deferrable ?? null,
                definition: definition(unique.name),
            });
        }).sort(byNameThenColumns),
        checks: table.checks
            .map((check) => named(check.name, { expression: check.expression as string, definition: definition(check.name) }))
            .sort((a, b) => compare(a.name, b.name) || compare(a.expression, b.expression)),
        exclusions: (table.exclusions ?? [])
            .map((exclusion) => named(exclusion.name, { expression: exclusion.expression ?? '', definition: definition(exclusion.name) }))
            .sort((a, b) => compare(a.name, b.name) || compare(a.expression, b.expression)),
        foreignKeys: table.foreignKeys.map((foreignKey) => named(foreignKey.name, {
            columns: [...foreignKey.columnNames],
            referencedTable: resolveName(foreignKey.referencedTableName, listed),
            referencedColumns: [...foreignKey.referencedColumnNames],
            onDelete: foreignKey.onDelete ?? null,
            onUpdate: foreignKey.onUpdate ?? null,
            deferrable: foreignKey.deferrable || null,
            definition: definition(foreignKey.name),
        })).sort(byNameThenColumns),
    };

    if (native.columns) {
        const { columns } = native;

        snapshot.columns = snapshot.columns
            .filter((column) => !columns.get(column.name)?.system)
            .map((column) => withNativeColumn(column, columns.get(column.name) as NativeColumn));
    }

    if (native.options !== undefined) {
        snapshot.options = native.options;
    }

    if (comments) {
        snapshot.comment = comments.comment;
        snapshot.columns = snapshot.columns.map((column) => ({ ...column, comment: comments.columns.get(column.name) ?? null }));
    }

    if (constraints) {
        const parts = native.constraintParts;

        if (parts.includes('primaryKey')) {
            snapshot.primaryKey = constraints.primaryKey;
        }

        if (parts.includes('uniques')) {
            snapshot.uniques = [...constraints.uniques].sort(byNameThenColumns);
        }

        if (parts.includes('foreignKeys')) {
            snapshot.foreignKeys = [...constraints.foreignKeys].sort(byNameThenColumns);
        }

        if (parts.includes('checks')) {
            snapshot.checks = [...constraints.checks].sort((a, b) => compare(a.name, b.name) || compare(a.expression, b.expression));
        }
    }

    return snapshot;
}

async function readSnapshot(
    dataSource: DataSource,
    queryRunner: QueryRunner,
    ignoreTables: string[],
): Promise<SchemaSnapshot> {
    const {
        listed,
        names,
        metadataTable,
    } = await readUserTableNames(dataSource, queryRunner, ignoreTables);

    // typeorm reads `a.b` as table b of schema (sqlite: database) a, which is another table or none
    const dotted = names.filter((name) => name.includes('.'));

    if (dotted.length > 0) {
        throw SchemaSnapshotError.tableNamesNotSupported(dotted);
    }

    const tables = names.length > 0 ? await queryRunner.getTables(names) : [];

    const { type } = dataSource.options;

    // typeorm does not read expression and partial indexes reliably: a native reader replaces its indices
    const indices = await readNativeIndices(queryRunner, names);

    // typeorm reports key columns in table column order: a native reader keeps the key order
    const keys = await readNativeKeys(queryRunner, names);

    // typeorm drops unnamed constraints (oracle), loses the key order (mssql, oracle) and reads no mysql checks
    const constraints = await readNativeConstraints(queryRunner, names);

    // typeorm reads no table comment on cockroachdb and none at all on mssql and oracle
    const comments = await readNativeComments(queryRunner, names);

    // typeorm takes a generated column's expression from its metadata table and skips some columns
    const columns = await readNativeColumns(queryRunner, names);

    // mariadb system versioning and mssql temporal tables
    const options = await readNativeTables(queryRunner, names);

    // cockroachdb, mssql and oracle qualify own types and functions even within the schema
    const schema = await readOwnSchema(queryRunner);

    // typeorm records views in the metadata table only, and may fail reading a missing one (mysql).
    const views = listed.includes(metadataTable) ? await queryRunner.getViews() : [];

    return {
        tables: tables
            .map((table) => {
                const name = resolveName(table.name, listed);
                const nativeColumns = columns ? columns.get(name) ?? new Map<string, NativeColumn>() : undefined;

                if (nativeColumns) {
                    assertColumnsRead(type, name, table.columns.map((column) => column.name), nativeColumns);
                }

                const snapshot = toTable(table, listed, {
                    indices: indices ? indices.get(name) ?? [] : undefined,
                    keys: keys ? keys.get(name) ?? { uniques: new Map(), definitions: new Map() } : undefined,
                    constraints: constraints ? constraints.get(name) ?? {
                        primaryKey: null,
                        uniques: [],
                        checks: [],
                        foreignKeys: [],
                    } : undefined,
                    constraintParts: readsConstraintParts(type),
                    comments: comments ? comments.get(name) ?? { comment: null, columns: new Map() } : undefined,
                    columns: nativeColumns,
                    options: options ? options.get(name) ?? null : undefined,
                });

                return schema ? unqualifyTable(snapshot, schema) : snapshot;
            })
            .sort((a, b) => compare(a.name, b.name)),
        views: views.map((view) : SchemaSnapshotView => ({
            name: unqualify(view.name),
            expression: typeof view.expression === 'string' ? view.expression : '',
            materialized: !!view.materialized,
        })).sort((a, b) => compare(a.name, b.name)),
    };
}

/**
 * Read a normalized description of the database schema. Nothing is written: a data
 * source built from options has `synchronize`, `migrationsRun` and `dropSchema`
 * disabled, and an uninitialized DataSource with any of them enabled is inspected
 * through an own instance (see `getSchemaDrift`). The migrations and metadata tables
 * are left out.
 *
 * @throws DriverError for a driver without a catalogue reader (supported: postgres, cockroachdb,
 * mysql, mariadb, better-sqlite3, mssql, oracle).
 *
 * @experimental The schema snapshot API may change in a minor release.
 */
export async function getSchemaSnapshot(
    input: DataSource | DataSourceOptions,
    options: SchemaSnapshotOptions = {},
): Promise<SchemaSnapshot> {
    const { type } = InstanceChecker.isDataSource(input) ? input.options : input;

    if (!buildUserTablesStatement(type)) {
        throw DriverError.notSupported(type);
    }

    const { dataSource, owned } = await useInitializedDataSource(input, {
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
    });

    let queryRunner: QueryRunner | undefined;

    try {
        queryRunner = options.queryRunner ?? dataSource.createQueryRunner();

        const runner = queryRunner;

        // postgres prints objects outside the search path qualified: pin it to the target schema
        return await withSchemaSearchPath(runner, () => readSnapshot(dataSource, runner, options.ignoreTables ?? []));
    } finally {
        if (!options.queryRunner && queryRunner) {
            await queryRunner.release();
        }

        if (owned) {
            await dataSource.destroy();
        }
    }
}
