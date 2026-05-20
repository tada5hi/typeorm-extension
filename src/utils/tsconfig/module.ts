import { isObject, load } from 'locter';
import path from 'node:path';
import type { TSConfig } from './type';

export async function readTSConfig(input?: string) : Promise<TSConfig> {
    input = input || process.cwd();
    input = path.isAbsolute(input) ?
        input :
        path.resolve(process.cwd(), input);

    const filePath = !input.includes('.json') ?
        path.join(input, 'tsconfig.json') :
        input;

    try {
        const tsConfig = await load(filePath);

        if (isObject(tsConfig)) {
            return tsConfig;
        }
    } catch {
        // don't do anything ;)
    }

    return {};
}
