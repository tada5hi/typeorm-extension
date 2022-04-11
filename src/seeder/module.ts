import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederConstructor, SeederOptions } from './type';
import { importSeed, loadFiles, setDefaultSeederOptions } from './utils';
import { modifyDataSourceOptionForRuntimeEnvironment } from '../data-source';

async function prepareSeeder(
    options?: SeederOptions,
) : Promise<SeederConstructor[]> {
    options = options ?? {};

    options = setDefaultSeederOptions(options);
    options = modifyDataSourceOptionForRuntimeEnvironment(options, 'seeds');

    const seedPaths : string[] = loadFiles(options.seeds);

    return Promise.all(seedPaths.map((seedPath) => importSeed(seedPath)));
}

export async function runSeeder(
    dataSource: DataSource,
    seederOptions?: SeederOptions,
) {
    if (typeof seederOptions === 'undefined') {
        seederOptions = {};

        const { seeds } = dataSource.options as DataSourceOptions & SeederOptions;

        if (typeof seeds !== 'undefined') {
            seederOptions.seeds = seeds;
        }
    }

    const seeds = await prepareSeeder(seederOptions);

    for (let i = 0; i < seeds.length; i++) {
        const Clazz = seeds[i];
        const clazz = new Clazz();

        const argLength = clazz.run.length;
        switch (argLength) {
            case 2:
                // support typeorm-seeding library ;)
                /* istanbul ignore next */
                try {
                    const typeOrmSeedingLibrary = 'typeorm-seeding';
                    const typeormSeeding = await import(typeOrmSeedingLibrary);
                    await (clazz.run as any)(typeormSeeding.factory, dataSource);
                } catch (e) {
                    await (clazz.run as any)(undefined, dataSource);
                }
                break;
            default:
                await clazz.run(dataSource);
                break;
        }
    }
}
