import { hasOwnProperty } from '../../utils';

export function setDefaultSeederOptions<T extends Record<string, any>>(options: T) : T {
    if (!hasOwnProperty(options, 'factories')) {
        Object.assign(options, {
            factories: [
                process.env.TYPEORM_SEEDING_FACTORIES ||
                'src/database/factories/**/*{.ts,.js}',
            ],
        });
    }

    if (!hasOwnProperty(options, 'seeds')) {
        Object.assign(options, {
            seeds: [
                process.env.TYPEORM_SEEDS ||
                process.env.TYPEORM_SEEDING_SEEDS ||
                'src/database/seeds/**/*{.ts,.js}',
            ],
        });
    }

    return options;
}
