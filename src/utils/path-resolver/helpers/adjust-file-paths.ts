import type { TSConfig } from '../../tsconfig';
import { createPathResolver } from '../module';

export async function adjustFilePaths<T extends Record<string, any>>(
    input: T,
    keys?: (keyof T)[],
    tsconfig?: string | TSConfig,
) : Promise<T> {
    return createPathResolver({ tsconfig }).transformKeys(input, keys);
}
