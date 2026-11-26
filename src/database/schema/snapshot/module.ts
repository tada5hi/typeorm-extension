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
import { readNativeGenerated, readsGeneratedIdentity } from './columns';
import { readNativeComments } from './comments';
import { readNativeConstraints } from './constraints';
import { readNativeIndices } from './indices';
import { readNativeKeys } from './keys';
import { withSchemaSearchPath } from './search-path';
import type {
    SchemaSnapshot,
    SchemaSnapshotColumn,
    SchemaSnapshotIndex,
    SchemaSnapshotOptions,
    SchemaSnapshotTable,
    SchemaSnapshotView,
} from './types';

type Reader = (...args: any[]) => Promise<Map<string, unknown> | undefined>;

type ReaderValue<T extends Reader> = NonNullable<Awaited<ReturnType<T>>> extends Map<string, infer V> ? V : never;

type NativeConstraints = ReaderValue<typeof readNativeConstraints>;

type NativeComments = ReaderValue<typeof readNativeComments>;

type NativeGenerated = ReaderValue<typeof readNativeGenerated> extends Map<string, infer V> ? V : never;

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

function named<T extends object>(name: string | undefined, value: T): T & { name?: string } {
    return name ? { name, ...value } : value;
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
    };
}

type TableKey = {
    name: string,
    columns: string[],
    deferrable: string | null
};

type TableKeys = {
    primary?: TableKey,
    uniques: Map<string, TableKey>,
    definitions: Map<string, string>
};

/**
 * Key columns in key order where the driver has a native key reader, sorted otherwise:
 * typeorm reports them in table column order, which says nothing about the key.
 */
function keyColumns(columns: string[], native?: { columns: string[] }): string[] {
    return native ? [...native.columns] : [...columns].sort();
}

function toTable(
    table: Table,
    listed: string[],
    native?: SchemaSnapshotIndex[],
    keys?: TableKeys,
    constraints?: NativeConstraints,
    comments?: NativeComments,
    generated?: Map<string, NativeGenerated>,
): SchemaSnapshotTable {
    const primary = table.columns.filter((column) => column.isPrimary);
    const primaryName = primary.find((column) => column.primaryKeyConstraintName)?.primaryKeyConstraintName;
    const definition = (name?: string) => (name ? keys?.definitions.get(name) ?? null : null);

    const snapshot: SchemaSnapshotTable = {
        name: resolveName(table.name, listed),
        comment: table.comment || null,
        columns: table.columns.map(toColumn).sort((a, b) => compare(a.name, b.name)),
        primaryKey: primary.length > 0 ?
            named(primaryName, {
                columns: keyColumns(primary.map((column) => column.name), keys?.primary),
                deferrable: keys?.primary?.deferrable ?? null,
                definition: definition(primaryName ?? keys?.primary?.name),
            }) :
            null,
        indices: native ? [...native].sort(byNameThenColumns) : table.indices.map((index) => named(index.name, {
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

    if (generated) {
        snapshot.columns = snapshot.columns.map((column) => {
            const native = generated.get(column.name);

            return {
                ...column,
                asExpression: native?.expression ?? null,
                generatedType: native?.generatedType ?? null,
                ...(native && native.identity !== undefined ? { generatedIdentity: native.identity } : {}),
            };
        });
    }

    if (comments) {
        snapshot.comment = comments.comment;
        snapshot.columns = snapshot.columns.map((column) => ({ ...column, comment: comments.columns.get(column.name) ?? null }));
    }

    if (constraints) {
        snapshot.primaryKey = constraints.primaryKey;
        snapshot.uniques = [...constraints.uniques].sort(byNameThenColumns);
        snapshot.foreignKeys = [...constraints.foreignKeys].sort(byNameThenColumns);
        snapshot.checks = [...constraints.checks].sort((a, b) => compare(a.name, b.name) || compare(a.expression, b.expression));
    }

    return snapshot;
}

/**
 * Mark every column the generated reader has no row for as plain, where it reads the identity:
 * no row means no identity there.
 */
function withIdentity(
    generated: Map<string, NativeGenerated>,
    table: Table,
    identity: boolean,
): Map<string, NativeGenerated> {
    if (!identity) {
        return generated;
    }

    const result = new Map(generated);

    for (const column of table.columns) {
        if (!result.has(column.name)) {
            result.set(column.name, {
                expression: null,
                generatedType: null,
                identity: null,
            });
        }
    }

    return result;
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

    // typeorm does not read expression and partial indexes reliably: a native reader replaces its indices
    const native = await readNativeIndices(queryRunner, names);

    // typeorm reports key columns in table column order: a native reader keeps the key order
    const keys = await readNativeKeys(queryRunner, names);

    // typeorm drops unnamed constraints (oracle) and loses the key order (mssql, oracle): a native reader replaces them
    const constraints = await readNativeConstraints(queryRunner, names);

    // typeorm reads no table comment on cockroachdb and none at all on mssql and oracle
    const comments = await readNativeComments(queryRunner, names);

    // typeorm takes a generated column's expression from its metadata table: the server's replaces it
    const generated = await readNativeGenerated(queryRunner, names);
    const identity = readsGeneratedIdentity(dataSource.options.type);

    // typeorm records views in the metadata table only, and may fail reading a missing one (mysql).
    const views = listed.includes(metadataTable) ? await queryRunner.getViews() : [];

    return {
        tables: tables
            .map((table) => {
                const name = resolveName(table.name, listed);

                return toTable(
                    table,
                    listed,
                    native ? native.get(name) ?? [] : undefined,
                    keys ? keys.get(name) ?? { uniques: new Map(), definitions: new Map() } : undefined,
                    constraints ? constraints.get(name) ?? {
                        primaryKey: null,
                        uniques: [],
                        checks: [],
                        foreignKeys: [],
                    } : undefined,
                    comments ? comments.get(name) ?? { comment: null, columns: new Map() } : undefined,
                    generated ? withIdentity(generated.get(name) ?? new Map(), table, identity) : undefined,
                );
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
