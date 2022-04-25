import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederConstructor, SeederOptions } from './type';
import { resolveFilePaths, resolveFilePatterns, setDefaultSeederOptions } from './utils';
import { modifyDataSourceOptionForRuntimeEnvironment } from '../data-source';
import { loadScriptFile, loadScriptFileSingleExport } from '../file';
import { SeederFactoryConfig, useSeederFactoryManager } from './factory';

async function prepareSeeder(
    options?: SeederOptions,
) : Promise<SeederConstructor[]> {
    options = options ?? {};

    options = setDefaultSeederOptions(options);
    options = modifyDataSourceOptionForRuntimeEnvironment(options, 'seeds');
    options = modifyDataSourceOptionForRuntimeEnvironment(options, 'factories');

    if (options.factories) {
        let factoryFiles : string[] = [];
        const factoryConfigs : SeederFactoryConfig[] = [];

        for (let i = 0; i < options.factories.length; i++) {
            const value = options.factories[i];
            if (typeof value === 'string') {
                factoryFiles.push(value);
            } else {
                factoryConfigs.push(value);
            }
        }

        if (factoryFiles.length > 0) {
            factoryFiles = resolveFilePatterns(factoryFiles);
            factoryFiles = resolveFilePaths(factoryFiles);

            for (let i = 0; i < factoryFiles.length; i++) {
                await loadScriptFile(factoryFiles[i]);
            }
        }

        if (factoryConfigs.length > 0) {
            const factoryManager = useSeederFactoryManager();

            for (let i = 0; i < factoryConfigs.length; i++) {
                factoryManager.set(
                    factoryConfigs[i].entity,
                    factoryConfigs[i].factoryFn,
                );
            }
        }
    }

    const items : SeederConstructor[] = [];

    if (options.seeds) {
        let seedFiles : string[] = [];
        const seedConstructors : SeederConstructor[] = [];

        for (let i = 0; i < options.seeds.length; i++) {
            const value = options.seeds[i];
            if (typeof value === 'string') {
                seedFiles.push(value);
            } else {
                seedConstructors.push(value);
            }
        }

        if (seedFiles.length > 0) {
            seedFiles = resolveFilePatterns(seedFiles);
            seedFiles = resolveFilePaths(seedFiles);

            for (let i = 0; i < seedFiles.length; i++) {
                const item = await loadScriptFileSingleExport(seedFiles[i]) as SeederConstructor;

                if (!options.seedName || options.seedName === item.name) {
                    items.push(item);
                }
            }
        }

        if (seedConstructors.length > 0) {
            for (let i = 0; i < seedConstructors.length; i++) {
                if (!options.seedName || options.seedName === seedConstructors[i].name) {
                    items.push(seedConstructors[i]);
                }
            }
        }
    }

    return items;
}

export async function runSeeder(
    dataSource: DataSource,
    Seeder: SeederConstructor,
    seederOptions?: SeederOptions,
) {
    seederOptions = seederOptions || {};
    seederOptions.seeds = [Seeder];
    seederOptions.factoriesLoad = seederOptions.factoriesLoad ?? true;

    if (
        seederOptions.factoriesLoad &&
        !seederOptions.factories
    ) {
        const { factories: dataSourceFactories } = dataSource.options as DataSourceOptions & SeederOptions;

        if (typeof dataSourceFactories !== 'undefined') {
            seederOptions.factories = dataSourceFactories;
        }
    }

    await prepareSeeder(seederOptions);
    const clazz = new Seeder();

    const factoryManager = useSeederFactoryManager();
    await clazz.run(dataSource, factoryManager);
}

export async function runSeeders(
    dataSource: DataSource,
    seederOptions?: SeederOptions,
) {
    seederOptions = seederOptions || {};

    const { seeds, factories } = dataSource.options as DataSourceOptions & SeederOptions;

    if (
        typeof seederOptions.seeds === 'undefined' &&
        typeof seeds !== 'undefined'
    ) {
        seederOptions.seeds = seeds;
    }

    if (
        typeof seederOptions.factories === 'undefined' &&
        typeof factories !== 'undefined'
    ) {
        seederOptions.factories = factories;
    }

    const items = await prepareSeeder(seederOptions);

    for (let i = 0; i < items.length; i++) {
        await runSeeder(dataSource, items[i], {
            factoriesLoad: false,
        });
    }
}
