import type { EnvironmentName } from './constants';

export interface Environment {
    env: `${EnvironmentName}`,
    seeds: string[],
    factories: string[]
}
