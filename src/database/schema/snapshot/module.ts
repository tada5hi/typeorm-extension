import type {
    DataSource,
    DataSourceOptions,
    QueryRunner,
    Table,
    TableColumn,
} from 'typeorm';
import { useInitializedDataSource } from '../utils';
import { readUserTableNames } from '../migration/tables';
import type {
    SchemaSnapshot,
    SchemaSnapshotColumn,
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
    };
}

function toTable(table: Table): SchemaSnapshotTable {
    const primary = table.columns.filter((column) => column.isPrimary);
    const primaryName = primary.find((column) => column.primaryKeyConstraintName)?.primaryKeyConstraintName;

    return {
        name: unqualify(table.name),
        columns: table.columns.map(toColumn).sort((a, b) => compare(a.name, b.name)),
        primaryKey: primary.length > 0 ?
            named(primaryName, { columns: primary.map((column) => column.name) }) :
            null,
        indices: table.indices.map((index) => named(index.name, {
            columns: [...index.columnNames],
            isUnique: !!index.isUnique,
            where: index.where || null,
            kind: (index.isSpatial && 'spatial' as const) || (index.isFulltext && 'fulltext' as const) || null,
            definition: null,
        })).sort(byNameThenColumns),
        uniques: table.uniques.map((unique) => named(unique.name, { columns: [...unique.columnNames] })).sort(byNameThenColumns),
        checks: table.checks
            .map((check) => named(check.name, { expression: check.expression as string }))
            .sort((a, b) => compare(a.name, b.name) || compare(a.expression, b.expression)),
        foreignKeys: table.foreignKeys.map((foreignKey) => named(foreignKey.name, {
            columns: [...foreignKey.columnNames],
            referencedTable: unqualify(foreignKey.referencedTableName),
            referencedColumns: [...foreignKey.referencedColumnNames],
            onDelete: foreignKey.onDelete ?? null,
            onUpdate: foreignKey.onUpdate ?? null,
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

    // typeorm records views in the metadata table only, and may fail reading a missing one (mysql).
    const views = listed.includes(metadataTable) ? await queryRunner.getViews() : [];

    return {
        tables: tables.map(toTable).sort((a, b) => compare(a.name, b.name)),
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
 * @experimental The schema snapshot API may change in a minor release.
 */
export async function getSchemaSnapshot(
    input: DataSource | DataSourceOptions,
    options: SchemaSnapshotOptions = {},
): Promise<SchemaSnapshot> {
    const { dataSource, owned } = await useInitializedDataSource(input, {
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
    });

    const queryRunner = options.queryRunner ?? dataSource.createQueryRunner();

    try {
        return await readSnapshot(dataSource, queryRunner, options.ignoreTables ?? []);
    } finally {
        if (!options.queryRunner) {
            await queryRunner.release();
        }

        if (owned) {
            await dataSource.destroy();
        }
    }
}
