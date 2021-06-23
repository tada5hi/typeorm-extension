import {Connection} from "typeorm";

import {ConnectionWithSeederOptions, SeederConstructor, SeederOptions} from "./type";
import {importSeed, loadFiles} from "./utils";
import {modifyConnectionOptionForRuntimeEnvironment} from "../connection";

export * from './utils';
export * from './type';

async function prepareSeeder(
    options?: SeederOptions
) : Promise<SeederConstructor[]> {
    options = options ?? {};
    if (!options.seeds) {
        options.seeds = [
            process.env.TYPEORM_SEEDS ||
            process.env.TYPEORM_SEEDING_SEEDS ||
            'src/database/seeds/**/*{.ts,.js}'
        ]
    }

    options = modifyConnectionOptionForRuntimeEnvironment(options, 'seeds');

    const seedPaths : string[] = loadFiles(options.seeds);

    return await Promise.all(seedPaths.map(seedPath => importSeed(seedPath)));
}

export async function runSeeder(
    connection: Connection,
    seederOptions?: SeederOptions
) {
    if(typeof seederOptions === 'undefined') {
        seederOptions = {};

        const {seeds} = connection.options as ConnectionWithSeederOptions;

        if(typeof seeds !== 'undefined') {
            seederOptions.seeds = seeds;
        }
    }

    const seeds = await prepareSeeder(seederOptions);

    for (const seed of seeds) {
        const clazz = new seed();

        const argLength = clazz.run.length;
        switch (argLength) {
            case 2:
                // support typeorm-seeding library
                try {
                    const typeOrmSeedingLibrary : string = 'typeorm-seeding';
                    const typeormSeeding = await import(typeOrmSeedingLibrary);
                    await (clazz.run as any)(typeormSeeding.factory, connection);
                } catch (e) {
                    await (clazz.run as any)(undefined, connection);
                }
                break;
            default:
                await clazz.run(connection);
                break;
        }
    }
}
