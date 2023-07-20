import { isObject, load } from 'locter';
import path from 'node:path';

type Tsconfig = {
    compilerOptions?: {
        outDir?: string,
        [key: string]: any
    },
    [key: string]: any
};

export async function readTsConfig(input?: string) : Promise<Tsconfig> {
    input = input || process.cwd();
    input = path.isAbsolute(input) ?
        input :
        path.resolve(process.cwd(), input);

    const filePath = input.indexOf('.json') === -1 ?
        path.join(input, 'tsconfig.json') :
        input;

    try {
        const tsConfig = await load(filePath);

        if (isObject(tsConfig)) {
            return tsConfig;
        }
    } catch (e) {
        if (input !== process.cwd()) {
            return readTsConfig(input);
        }
        // don't do anything ;)
    }

    return {};
}
