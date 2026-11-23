/* eslint-disable max-classes-per-file */
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { describe, expect, it } from 'vitest';
import type { MigrationsInput } from '../../../../../src';
import {
    MigrationBaseline,
    MigrationPlanError,
    PathResolverMode,
    createPathResolver,
    scanMigrationSource,
} from '../../../../../src';
import { createDataSource } from '../../../../data/typeorm/factory';
import { AddWidgetSize1700000000004 } from '../../../../data/typeorm/migration-baseline/add-widget-size';
import { Baseline1700000000003 } from '../../../../data/typeorm/migration-baseline/baseline';
import { AddWidgetColor1700000000002 } from '../../../../data/typeorm/migration-baseline/legacy/add-widget-color';
import { CreateWidget1700000000001 } from '../../../../data/typeorm/migration-baseline/legacy/create-widget';

function dataSourceOf(migrations: MigrationsInput, type: string = 'better-sqlite3') {
    const dataSource = createDataSource({
        type: 'better-sqlite3',
        database: ':memory:',
        migrations,
    } as any);

    (dataSource.options as any).type = type;

    return dataSource;
}

function named(name: string) {
    return class implements MigrationInterface {
        name = name;

        async up(_queryRunner: QueryRunner): Promise<void> {
            // noop
        }

        async down(_queryRunner: QueryRunner): Promise<void> {
            // noop
        }
    };
}

function namedBaseline(name: string, legacy?: MigrationsInput) {
    return class extends MigrationBaseline {
        static override legacy = legacy;

        name = name;

        async up(_queryRunner: QueryRunner): Promise<void> {
            // noop
        }
    };
}

describe('src/database/schema/migration/source', () => {
    it('should discover the baseline from the migration list', async () => {
        const source = await scanMigrationSource(
            dataSourceOf([AddWidgetSize1700000000004, Baseline1700000000003]),
        );

        expect(source.baseline?.name).toEqual('Baseline1700000000003');
        expect(source.current.map((m) => m.name)).toEqual(['Baseline1700000000003', 'AddWidgetSize1700000000004']);
        expect(source.legacy?.map((m) => m.name)).toEqual(['CreateWidget1700000000001', 'AddWidgetColor1700000000002']);
        expect(source.upgradeHint).toEqual('Upgrade through the previous release first.');
        expect(source.current[0].id).toBeUndefined();
    });

    it('should accept an explicit baseline', async () => {
        const source = await scanMigrationSource(
            dataSourceOf([AddWidgetSize1700000000004, Baseline1700000000003]),
            { baseline: Baseline1700000000003 },
        );

        expect(source.baseline?.name).toEqual('Baseline1700000000003');
        expect(source.legacy).toHaveLength(2);
    });

    it('should refuse two baselines even with an explicit one', async () => {
        const Other = namedBaseline('Other1700000000006', []);

        await expect(scanMigrationSource(
            dataSourceOf([Other, Baseline1700000000003]),
            { baseline: Baseline1700000000003 },
        )).rejects.toMatchObject({ message: MigrationPlanError.multipleBaselines(['Baseline1700000000003', 'Other1700000000006']).message });
    });

    it('should refuse a migration declaring baseline properties without being a baseline', async () => {
        class WithLegacy1700000000005 implements MigrationInterface {
            static legacy = [CreateWidget1700000000001];

            async up(): Promise<void> {
                // noop
            }

            async down(): Promise<void> {
                // noop
            }
        }

        class WithHint1700000000005 extends WithLegacy1700000000005 {
            static override legacy = undefined;

            static upgradeHint = 'Upgrade first.';
        }

        class WithFlag1700000000005 extends WithLegacy1700000000005 {
            static override legacy = undefined;

            static baseline = 'yes';
        }

        for (const Class of [WithLegacy1700000000005, WithHint1700000000005, WithFlag1700000000005]) {
            await expect(scanMigrationSource(dataSourceOf([AddWidgetSize1700000000004, Class])))
                .rejects.toMatchObject({ message: MigrationPlanError.baselineMalformed(Class.name).message });
        }
    });

    it('should return current only without a baseline', async () => {
        const source = await scanMigrationSource(dataSourceOf([AddWidgetSize1700000000004]));

        expect(source.current).toHaveLength(1);
        expect(source.baseline).toBeUndefined();
        expect(source.legacy).toBeUndefined();
    });

    it('should load legacy from classes and from a glob', async () => {
        const Classes = namedBaseline('Classes1700000000003', [CreateWidget1700000000001, AddWidgetColor1700000000002]);
        const fromClasses = await scanMigrationSource(dataSourceOf([Classes]));
        const fromGlob = await scanMigrationSource(dataSourceOf([Baseline1700000000003]));

        expect(fromClasses.legacy?.map((m) => m.name)).toEqual(fromGlob.legacy?.map((m) => m.name));
        expect(fromGlob.legacy).toHaveLength(2);
    });

    it('should refuse duplicate names across current and legacy', async () => {
        const Clash = named('CreateWidget1700000000001');
        const promise = scanMigrationSource(dataSourceOf([Baseline1700000000003, Clash]));

        await expect(promise).rejects.toThrow(MigrationPlanError.duplicateNames([]).constructor);
        await expect(promise).rejects.toMatchObject({ names: ['CreateWidget1700000000001'] });
    });

    it('should refuse two baselines', async () => {
        const Second = namedBaseline('Second1700000000005', []);

        await expect(scanMigrationSource(dataSourceOf([Baseline1700000000003, Second]))).rejects.toMatchObject({
            names: ['Baseline1700000000003', 'Second1700000000005'],
            message: MigrationPlanError.multipleBaselines(['Baseline1700000000003', 'Second1700000000005']).message,
        });
    });

    it('should refuse an explicit baseline not in the list', async () => {
        await expect(scanMigrationSource(
            dataSourceOf([AddWidgetSize1700000000004]),
            { baseline: Baseline1700000000003 },
        )).rejects.toMatchObject({ message: MigrationPlanError.baselineNotInList('Baseline1700000000003').message });
    });

    it('should refuse a legacy migration in the current list', async () => {
        await expect(scanMigrationSource(
            dataSourceOf([Baseline1700000000003, CreateWidget1700000000001]),
        )).rejects.toMatchObject({ names: ['CreateWidget1700000000001'], message: /must not be part/ });
    });

    it('a baseline without legacy scans with legacy undefined', async () => {
        const Plain = namedBaseline('Plain1700000000003');
        const source = await scanMigrationSource(dataSourceOf([Plain, AddWidgetSize1700000000004]));

        expect(source.baseline?.name).toEqual('Plain1700000000003');
        expect(source.legacy).toBeUndefined();

        await expect(scanMigrationSource(dataSourceOf([named('Old1600000000000'), Plain])))
            .rejects.toMatchObject({ message: MigrationPlanError.currentOlderThanBaseline(['Old1600000000000']).message });
    });

    it('should refuse a legacy glob matching nothing', async () => {
        const Empty = namedBaseline('Empty1700000000003', ['test/data/typeorm/nothing/*.ts']);

        await expect(scanMigrationSource(dataSourceOf([Empty]))).rejects.toMatchObject({ message: MigrationPlanError.legacyEmpty('Empty1700000000003').message });
    });

    it('should refuse a legacy migration not older than the baseline', async () => {
        const Early = namedBaseline('Early1700000000002', [CreateWidget1700000000001, AddWidgetColor1700000000002]);

        await expect(scanMigrationSource(dataSourceOf([Early]))).rejects.toMatchObject({ message: MigrationPlanError.legacyNotOlder(['AddWidgetColor1700000000002']).message });
    });

    it('should refuse a current migration older than the baseline', async () => {
        const Old = named('Old1600000000000');

        await expect(scanMigrationSource(dataSourceOf([Old, Baseline1700000000003]))).rejects.toMatchObject({ message: MigrationPlanError.currentOlderThanBaseline(['Old1600000000000']).message });
    });

    it('should refuse a baseline on mongodb', async () => {
        await expect(scanMigrationSource(
            dataSourceOf([Baseline1700000000003], 'mongodb'),
        )).rejects.toMatchObject({ message: MigrationPlanError.driverNotSupported('mongodb').message });
    });

    it('should resolve the legacy globs through the path resolver', async () => {
        const tsconfig = { compilerOptions: { rootDir: 'test', outDir: 'test-compiled' } };

        const pathResolver = createPathResolver({ mode: PathResolverMode.PRESERVE, tsconfig });
        const preserved = await scanMigrationSource(dataSourceOf([Baseline1700000000003]), { pathResolver });

        expect(preserved.legacy).toHaveLength(2);

        // the source glob is rewritten to the compiled location, which holds nothing.
        await expect(scanMigrationSource(dataSourceOf([Baseline1700000000003]), {
            pathResolver: createPathResolver({
                mode: PathResolverMode.TRANSFORM,
                tsconfig,
                typescript: true,
            }),
        })).rejects.toMatchObject({ message: MigrationPlanError.legacyEmpty('Baseline1700000000003').message });
    });
});
