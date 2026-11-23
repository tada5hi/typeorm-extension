import { Migration } from 'typeorm';
import type { DataSource, MigrationInterface } from 'typeorm';
import { importClassesFromDirectories } from 'typeorm/util/DirectoryExportedClassesLoader';
import { MigrationPlanError } from '../../../errors';
import type { IPathResolver } from '../../../utils';
import { PathResolverMode, createPathResolver } from '../../../utils';
import { isMigrationBaselineClass } from './baseline';
import type {
    MigrationBaselineClass,
    MigrationSource,
    MigrationSourceScanOptions,
    MigrationsInput,
} from './types';

type MigrationClass = new () => MigrationInterface;

function toList(input: MigrationsInput): (string | MigrationClass)[] {
    if (!input) {
        return [];
    }

    if (Array.isArray(input)) {
        return input as (string | MigrationClass)[];
    }

    return Object.values(input) as (string | MigrationClass)[];
}

async function buildInstances(
    dataSource: DataSource,
    input: MigrationsInput,
    pathResolver?: IPathResolver,
): Promise<MigrationInterface[]> {
    const classes: MigrationClass[] = [];
    const directories: string[] = [];

    for (const item of toList(input)) {
        if (typeof item === 'string') {
            directories.push(pathResolver ? await pathResolver.transform(item) : item);
        } else {
            classes.push(item);
        }
    }

    if (directories.length > 0) {
        const loaded = await importClassesFromDirectories(dataSource.logger, directories);

        classes.push(...(loaded as MigrationClass[]));
    }

    return classes.map((Class) => new Class());
}

function toMigration(instance: MigrationInterface): Migration {
    const name = instance.name ?? instance.constructor.name;
    const timestamp = parseInt(name.slice(-13), 10);

    if (!timestamp || Number.isNaN(timestamp)) {
        throw new Error(`${name} migration name is wrong. Migration class name should have a JavaScript timestamp appended.`);
    }

    return new Migration(undefined, timestamp, name, instance);
}

/**
 * A class carrying any baseline property without being a baseline would
 * otherwise run as an ordinary migration.
 */
function declaresBaselineProperties(Class: unknown): boolean {
    if (typeof Class !== 'function') {
        return false;
    }

    const record = Class as {
        baseline?: unknown,
        legacy?: unknown,
        upgradeHint?: unknown
    };

    return record.baseline !== undefined ||
        record.legacy !== undefined ||
        record.upgradeHint !== undefined;
}

function sortMigrations(items: Migration[]): Migration[] {
    return items.sort((a, b) => a.timestamp - b.timestamp);
}

function findDuplicates(names: string[]): string[] {
    return Array.from(new Set(names.filter((name, index) => names.indexOf(name) < index)));
}

/**
 * Collect the migrations of a data source and, when one of them is a baseline,
 * the legacy migrations it replaces. No connection is needed: an initialized data
 * source supplies its migration instances, an uninitialized one is built from its options.
 */
export async function scanMigrationSource(
    dataSource: DataSource,
    options: MigrationSourceScanOptions = {},
): Promise<MigrationSource> {
    const instances = dataSource.isInitialized ?
        dataSource.migrations :
        await buildInstances(dataSource, dataSource.options.migrations);

    const current = sortMigrations(instances.map(toMigration));

    const malformed = current.find((migration) => {
        const Class = migration.instance?.constructor;

        return !isMigrationBaselineClass(Class) && declaresBaselineProperties(Class);
    });

    if (malformed) {
        throw MigrationPlanError.baselineMalformed(malformed.name);
    }

    const baselines = current.filter((migration) => isMigrationBaselineClass(migration.instance?.constructor));

    if (baselines.length > 1) {
        throw MigrationPlanError.multipleBaselines(baselines.map((migration) => migration.name));
    }

    let baselineMigration: Migration | undefined;

    if (options.baseline) {
        baselineMigration = current.find((migration) => migration.instance?.constructor === options.baseline);

        if (!baselineMigration) {
            throw MigrationPlanError.baselineNotInList(options.baseline.name);
        }
    } else {
        [baselineMigration] = baselines;
    }

    if (!baselineMigration) {
        const duplicates = findDuplicates(current.map((migration) => migration.name));

        if (duplicates.length > 0) {
            throw MigrationPlanError.duplicateNames(duplicates);
        }

        return { current };
    }

    if (dataSource.options.type === 'mongodb') {
        throw MigrationPlanError.driverNotSupported(dataSource.options.type);
    }

    const baselineClass = baselineMigration.instance!.constructor;

    if (!isMigrationBaselineClass(baselineClass)) {
        throw MigrationPlanError.baselineNotInList(baselineMigration.name);
    }

    const baseline = baselineMigration;

    let legacy: Migration[] | undefined;

    if (baselineClass.legacy !== undefined) {
        const legacyInstances = await buildInstances(
            dataSource,
            baselineClass.legacy,
            options.pathResolver ?? createPathResolver({ mode: PathResolverMode.AUTO }),
        );

        if (legacyInstances.length === 0) {
            throw MigrationPlanError.legacyEmpty(baseline.name);
        }

        legacy = sortMigrations(legacyInstances.map(toMigration));

        const inList = legacy.filter((item) => current.some(
            (migration) => migration.instance?.constructor === item.instance?.constructor,
        ));

        if (inList.length > 0) {
            throw MigrationPlanError.legacyInList(inList.map((item) => item.name));
        }

        const notOlder = legacy.filter((item) => item.timestamp >= baseline.timestamp);

        if (notOlder.length > 0) {
            throw MigrationPlanError.legacyNotOlder(notOlder.map((item) => item.name));
        }
    }

    const duplicates = findDuplicates([...current, ...(legacy ?? [])].map((migration) => migration.name));

    if (duplicates.length > 0) {
        throw MigrationPlanError.duplicateNames(duplicates);
    }

    const older = current.filter((item) => item !== baseline && item.timestamp < baseline.timestamp);

    if (older.length > 0) {
        throw MigrationPlanError.currentOlderThanBaseline(older.map((item) => item.name));
    }

    return {
        current,
        baseline,
        legacy,
        upgradeHint: baselineClass.upgradeHint,
    };
}
