import glob from 'glob';
import path from 'path';
import { SeederConstructor, SeederOptions } from './type';

/* istanbul ignore next */
export function loadFiles(filesPattern: string[]) : string[] {
    return filesPattern
        .map((pattern) => glob.sync(
            path.isAbsolute(pattern) ?
                pattern :
                path.resolve(process.cwd(), pattern),
        ))
        .reduce((acc, el) => acc.concat(el));
}

/* istanbul ignore next */
export async function importSeed(filePath: string): Promise<SeederConstructor> {
    const seedFileObject: { [key: string]: SeederConstructor } = await import(filePath);

    const keys = Object.keys(seedFileObject);

    return seedFileObject[keys[0]];
}

export function createDefaultSeederOptions<T extends SeederOptions>(options: T) : T {
    if (!options.factories) {
        options.factories = [
            process.env.TYPEORM_SEEDING_FACTORIES ||
            'src/database/factories/**/*{.ts,.js}',
        ];
    }
    if (!options.seeds) {
        options.seeds = [
            process.env.TYPEORM_SEEDS ||
            process.env.TYPEORM_SEEDING_SEEDS ||
            'src/database/seeds/**/*{.ts,.js}',
        ];
    }

    return options;
}
