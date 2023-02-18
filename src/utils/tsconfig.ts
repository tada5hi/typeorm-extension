import { load } from 'locter';
import path from 'node:path';

type Tsconfig = {
    compilerOptions?: {
        outDir?: string,
        [key: string]: any
    },
    [key: string]: any
};

export async function readTsConfig(directory?: string) : Promise<Tsconfig> {
    directory = directory || process.cwd();
    directory = path.isAbsolute(directory) ? directory : path.join(process.cwd(), directory);

    const filePath = directory.indexOf('.json') === -1 ?
        path.join(directory, 'tsconfig.json') :
        directory;
    try {
        const tsConfig = await load(filePath);

        // todo: maybe follow extends chain ;)

        if (typeof tsConfig === 'object') {
            return tsConfig;
        }
    } catch (e) {
        // don't do anything ;)
    }

    return {};
}
