import type { DataSourceOptions } from 'typeorm';
import { useEnv } from '../../env';
import type { SeederOptions } from '../type';

export function setDefaultSeederOptions<T extends Partial<DataSourceOptions> & SeederOptions>(options: T) : T {
    if (
        !Array.isArray(options.factories) ||
        options.factories.length === 0
    ) {
        let factories = useEnv('factories');
        if (factories.length === 0) {
            factories = ['src/database/factories/**/*{.ts,.js}'];
        }

        Object.assign(options, {
            factories,
        });
    }

    if (
        !Array.isArray(options.seeds) ||
        options.seeds.length === 0
    ) {
        let seeds = useEnv('seeds');
        if (seeds.length === 0) {
            seeds = ['src/database/seeds/**/*{.ts,.js}'];
        }

        Object.assign(options, {
            seeds,
        });
    }

    return options;
}
