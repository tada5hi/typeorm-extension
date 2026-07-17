import type { Environment } from '../env';
import type { SeederConfig, SeederOptions } from './type';

const SEEDS_DEFAULT = ['src/database/seeds/**/*{.ts,.js}'];
const FACTORIES_DEFAULT = ['src/database/factories/**/*{.ts,.js}'];

function firstNonEmpty<T extends unknown[]>(
    ...candidates: (T | undefined)[]
) : T | undefined {
    return candidates.find(
        (candidate) => typeof candidate !== 'undefined' && candidate.length > 0,
    );
}

export function resolveSeederConfig(
    input: SeederOptions = {},
    dataSourceOptions: SeederOptions = {},
    env: Pick<Environment, 'seeds' | 'factories'> = { seeds: [], factories: [] },
) : SeederConfig {
    return {
        seeds: firstNonEmpty(input.seeds, dataSourceOptions.seeds, env.seeds) ??
            SEEDS_DEFAULT,
        seedName: input.seedName,
        seedTableName: dataSourceOptions.seedTableName || 'seeds',
        seedTracking: input.seedTracking ?? false,
        factories: firstNonEmpty(input.factories, dataSourceOptions.factories, env.factories) ??
            FACTORIES_DEFAULT,
    };
}
