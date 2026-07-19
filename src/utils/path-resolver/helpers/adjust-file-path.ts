import type { TSConfig } from '../../tsconfig';
import { createPathResolver } from '../module';

export async function adjustFilePath<T extends unknown | unknown[]>(
    input: T,
    tsconfig?: string | TSConfig,
) : Promise<T> {
    const resolver = createPathResolver({ tsconfig });

    if (typeof input === 'string') {
        return await resolver.transform(input) as T;
    }

    if (Array.isArray(input)) {
        for (let i = 0; i < input.length; i++) {
            if (typeof input[i] === 'string') {
                input[i] = await resolver.transform(input[i]);
            }
        }
    }

    return input;
}
