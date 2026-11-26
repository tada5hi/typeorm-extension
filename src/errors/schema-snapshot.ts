import type { SchemaSnapshotDifference } from '../database/schema/snapshot/types';
import { TypeormExtensionError } from './base';

function buildMessage(differences: SchemaSnapshotDifference[]): string {
    const lines = differences.map((difference) => {
        if (difference.kind === 'changed') {
            return `${difference.path}: changed, expected ${JSON.stringify(difference.expected)}, actual ${JSON.stringify(difference.actual)}`;
        }

        return `${difference.path}: ${difference.kind}`;
    });

    return [
        `The schema snapshots differ (${differences.length} difference(s)):`,
        ...lines,
    ].join('\n');
}

/**
 * @experimental The schema snapshot API may change in a minor release.
 */
export class SchemaSnapshotError extends TypeormExtensionError {
    /**
     * The differences between the expected and the actual snapshot.
     */
    readonly differences: SchemaSnapshotDifference[];

    constructor(differences: SchemaSnapshotDifference[] = [], message?: string) {
        super(message || buildMessage(differences));

        this.differences = differences;
    }

    static differs(differences: SchemaSnapshotDifference[]) {
        return new SchemaSnapshotError(differences);
    }

    static columnsNotRead(driver: string, table: string, missing: string[], extra: string[]) {
        const parts = [
            missing.length > 0 ? `typeorm did not read the column(s) ${missing.join(', ')}` : '',
            extra.length > 0 ? `typeorm read the column(s) ${extra.join(', ')}, which the catalogue does not list` : '',
        ].filter((part) => part);
        const causes: Record<string, string> = { cockroachdb: 'typeorm skips a NOT VISIBLE column' };
        const cause = causes[driver] ?? `the ${driver} catalogue and typeorm's table reader disagree`;

        return new SchemaSnapshotError(
            [],
            `The table ${table} can not be snapshot: ${parts.join('; ')} (${cause}). ` +
            'List it in ignoreTables to snapshot the other tables.',
        );
    }

    static onUpdateNotReadable(table: string, line: string) {
        return new SchemaSnapshotError(
            [],
            `The ON UPDATE clause of the table ${table} can not be read for sure from: ${line}. ` +
            'List the table in ignoreTables to snapshot the other tables.',
        );
    }

    static checksNotReadable(driver: string) {
        return new SchemaSnapshotError(
            [],
            `The ${driver} server does not list its checks with their table (information_schema.check_constraints ` +
            'needs TABLE_NAME and CHECK_CLAUSE), so a snapshot could not compare them.',
        );
    }

    static generatedColumnsNotSupported(table: string, columns: string[]) {
        return new SchemaSnapshotError(
            [],
            `The table ${table} has the generated column(s) ${columns.join(', ')}, whose expression ` +
            'better-sqlite3 does not report: the snapshot could not compare it. List the table in ignoreTables to snapshot the other tables.',
        );
    }

    static tableNamesNotSupported(names: string[]) {
        return new SchemaSnapshotError(
            [],
            `The table name(s) ${names.join(', ')} contain a dot, which typeorm reads as a qualifier. ` +
            'List them in ignoreTables to snapshot the other tables.',
        );
    }
}
