import type {
    DataSource,
    DataSourceOptions,
    QueryRunner,
    Table,
    TableColumn,
} from 'typeorm';
import { InstanceChecker } from 'typeorm';
import { DriverError } from '../../../errors/driver';
import { useInitializedDataSource } from '../utils';
import { buildUserTablesStatement, readUserTableNames } from '../migration/tables';
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

function unqualify(name: string): string {
    const index = name.lastIndexOf('.');

    return index === -1 ? name : name.slice(index + 1);
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
    native?: SchemaSnapshotIndex[],
    keys?: TableKeys,
): SchemaSnapshotTable {
    const primary = table.columns.filter((column) => column.isPrimary);
    const primaryName = primary.find((column) => column.primaryKeyConstraintName)?.primaryKeyConstraintName;
    const definition = (name?: string) => (name ? keys?.definitions.get(name) ?? null : null);

    return {
        name: unqualify(table.name),
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
            referencedTable: unqualify(foreignKey.referencedTableName),
            referencedColumns: [...foreignKey.referencedColumnNames],
            onDelete: foreignKey.onDelete ?? null,
            onUpdate: foreignKey.onUpdate ?? null,
            deferrable: foreignKey.deferrable || null,
            definition: definition(foreignKey.name),
        })).sort(byNameThenColumns),
    };
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

    const tables = names.length > 0 ? await queryRunner.getTables(names) : [];

    // typeorm does not read expression and partial indexes reliably: a native reader replaces its indices
    const native = await readNativeIndices(queryRunner, names);

    // typeorm reports key columns in table column order: a native reader keeps the key order
    const keys = await readNativeKeys(queryRunner, names);

    // typeorm records views in the metadata table only, and may fail reading a missing one (mysql).
    const views = listed.includes(metadataTable) ? await queryRunner.getViews() : [];

    return {
        tables: tables
            .map((table) => {
                const name = unqualify(table.name);

                return toTable(
                    table,
                    native ? native.get(name) ?? [] : undefined,
                    keys ? keys.get(name) ?? { uniques: new Map(), definitions: new Map() } : undefined,
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
