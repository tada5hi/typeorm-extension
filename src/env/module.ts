import type { EnvironmentName } from './constants';
import type { Environment } from './type';
import { hasProcessEnv, readFromProcessEnv } from './utils';

let instance : Environment | undefined;

export function useEnv() : Environment;
export function useEnv<K extends keyof Environment>(key: K) : Environment[K];
export function useEnv(key?: string) : any {
    if (typeof instance !== 'undefined') {
        if (typeof key === 'string') {
            return instance[key as keyof Environment];
        }

        return instance;
    }

    const seeds : string[] = [];
    const seedKeys = ['DATABASE_SEEDER_SEEDS', 'TYPEORM_SEEDING_SEEDS'];
    for (let i = 0; i < seedKeys.length; i++) {
        if (!hasProcessEnv(seedKeys[i])) {
            continue;
        }

        seeds.push(...readFromProcessEnv(seedKeys[i], '').split(','));
    }

    const factories : string[] = [];
    const factoryKeys = ['DATABASE_SEEDER_FACTORIES', 'TYPEORM_SEEDING_FACTORIES'];
    for (let i = 0; i < factoryKeys.length; i++) {
        if (!hasProcessEnv(factoryKeys[i])) {
            continue;
        }

        factories.push(...readFromProcessEnv(factoryKeys[i], '').split(','));
    }

    instance = {
        env: readFromProcessEnv('NODE_ENV', 'development') as `${EnvironmentName}`,
        seeds: seeds.filter((el) => el),
        factories: factories.filter((el) => el),
    };

    if (typeof key === 'string') {
        return instance[key as keyof Environment];
    }

    return instance;
}
