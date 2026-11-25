import { SchemaSnapshotError } from '../../../errors/schema-snapshot';
import type {
    SchemaSnapshot,
    SchemaSnapshotDifference,
    SchemaSnapshotTable,
} from './types';

function isEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
        return true;
    }

    if (Array.isArray(a) || Array.isArray(b)) {
        return Array.isArray(a) &&
            Array.isArray(b) &&
            a.length === b.length &&
            a.every((value, i) => isEqual(value, b[i]));
    }

    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

        return [...keys].every((key) => isEqual(
            (a as Record<string, unknown>)[key],
            (b as Record<string, unknown>)[key],
        ));
    }

    return false;
}

function groupByKey<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
    const groups = new Map<string, T[]>();

    for (const item of items) {
        const key = keyOf(item);
        const group = groups.get(key);

        if (group) {
            group.push(item);
        } else {
            groups.set(key, [item]);
        }
    }

    return groups;
}

/**
 * Compare two keyed lists. Elements sharing a key are paired by equality first,
 * what is left over is reported. `onChanged` handles a lone pair on both sides.
 */
function compareKeyed<T>(
    path: string,
    expected: T[],
    actual: T[],
    keyOf: (item: T) => string,
    out: SchemaSnapshotDifference[],
    onChanged?: (path: string, expected: T, actual: T) => void,
) {
    const expectedGroups = groupByKey(expected, keyOf);
    const actualGroups = groupByKey(actual, keyOf);
    const keys = new Set([...expectedGroups.keys(), ...actualGroups.keys()]);

    for (const key of keys) {
        const left = [...(expectedGroups.get(key) ?? [])];
        const right = [...(actualGroups.get(key) ?? [])];
        const itemPath = `${path}.${key}`;
        const duplicated = left.length > 1 || right.length > 1;

        for (let i = left.length - 1; i >= 0; i--) {
            const match = right.findIndex((item) => isEqual(left[i], item));

            if (match !== -1) {
                left.splice(i, 1);
                right.splice(match, 1);
            }
        }

        if (left.length === 1 && right.length === 1) {
            if (onChanged) {
                onChanged(itemPath, left[0], right[0]);
            } else {
                out.push({
                    path: itemPath,
                    kind: 'changed',
                    expected: left[0],
                    actual: right[0],
                });
            }
        } else {
            left.forEach((item, i) => {
                out.push({
                    path: duplicated ? `${itemPath}#${i}` : itemPath,
                    kind: 'missing',
                    expected: item,
                });
            });
            right.forEach((item, i) => {
                out.push({
                    path: duplicated ? `${itemPath}#${i}` : itemPath,
                    kind: 'extra',
                    actual: item,
                });
            });
        }
    }
}

function compareTable(
    path: string,
    expected: SchemaSnapshotTable,
    actual: SchemaSnapshotTable,
    out: SchemaSnapshotDifference[],
) {
    if (!isEqual(expected.comment, actual.comment)) {
        out.push({
            path: `${path}.comment`,
            kind: 'changed',
            expected: expected.comment,
            actual: actual.comment,
        });
    }

    compareKeyed(
        `${path}.columns`,
        expected.columns,
        actual.columns,
        (column) => column.name,
        out,
        (columnPath, a, b) => {
            const properties = new Set([...Object.keys(a), ...Object.keys(b)]);

            for (const property of properties) {
                const left = (a as Record<string, unknown>)[property];
                const right = (b as Record<string, unknown>)[property];

                if (!isEqual(left, right)) {
                    out.push({
                        path: `${columnPath}.${property}`,
                        kind: 'changed',
                        expected: left,
                        actual: right,
                    });
                }
            }
        },
    );

    if (!isEqual(expected.primaryKey, actual.primaryKey)) {
        out.push({
            path: `${path}.primaryKey`,
            kind: 'changed',
            expected: expected.primaryKey,
            actual: actual.primaryKey,
        });
    }

    const byColumns = (item: { name?: string, columns: string[] }) => item.name ?? item.columns.join(',');

    compareKeyed(`${path}.indices`, expected.indices, actual.indices, byColumns, out);
    compareKeyed(`${path}.uniques`, expected.uniques, actual.uniques, byColumns, out);
    compareKeyed(`${path}.foreignKeys`, expected.foreignKeys, actual.foreignKeys, byColumns, out);
    compareKeyed(
        `${path}.checks`,
        expected.checks,
        actual.checks,
        (check) => check.name ?? check.expression,
        out,
    );
    compareKeyed(
        `${path}.exclusions`,
        expected.exclusions,
        actual.exclusions,
        (exclusion) => exclusion.name ?? exclusion.expression,
        out,
    );
}

/**
 * Compare two schema snapshots. The order of the lists inside a snapshot is
 * irrelevant, elements are matched by name (or by columns / expression when unnamed).
 *
 * @experimental The schema snapshot API may change in a minor release.
 *
 * @param expected The snapshot which is the reference.
 * @param actual The snapshot which is checked against it.
 * @returns The differences sorted by path, empty when the snapshots match.
 */
export function compareSchemaSnapshots(
    expected: SchemaSnapshot,
    actual: SchemaSnapshot,
): SchemaSnapshotDifference[] {
    const out: SchemaSnapshotDifference[] = [];

    compareKeyed(
        'tables',
        expected.tables,
        actual.tables,
        (item) => item.name,
        out,
        (path, a, b) => compareTable(path, a, b, out),
    );
    compareKeyed('views', expected.views, actual.views, (item) => item.name, out);

    return out.sort((a, b) => {
        if (a.path < b.path) {
            return -1;
        }

        return a.path > b.path ? 1 : 0;
    });
}

/**
 * Throw a {@link SchemaSnapshotError} when two schema snapshots differ.
 *
 * @experimental The schema snapshot API may change in a minor release.
 */
export function assertSchemaSnapshotsEqual(expected: SchemaSnapshot, actual: SchemaSnapshot): void {
    const differences = compareSchemaSnapshots(expected, actual);

    if (differences.length > 0) {
        throw SchemaSnapshotError.differs(differences);
    }
}
