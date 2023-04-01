import type { DataSourceOptions } from 'typeorm';
import type { SeederOptions } from '../../../seeder';
import {
    CodeTransformation,
    hasOwnProperty,
    isCodeTransformation,
    transformFilePath,
} from '../../../utils';
import { readTsConfig } from '../../../utils/tsconfig';

const keys = [
    'entities',
    'migrations',
    'seeds',
    'factories',
    'subscribers',
];

export async function adjustFilePathsForDataSourceOptions<T extends Partial<DataSourceOptions> & SeederOptions>(
    input: T,
    options?: {
        root?: string,
        keys?: string[]
    },
) : Promise<T> {
    if (isCodeTransformation(CodeTransformation.JUST_IN_TIME)) {
        return input;
    }

    options = options || {};

    const { compilerOptions } = await readTsConfig(options.root);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i] as keyof T;

        if (
            !hasOwnProperty(input, key) ||
            (options.keys && options.keys.indexOf(key as string) === -1)
        ) {
            continue;
        }

        let value = input[key] as unknown;
        if (typeof value === 'string') {
            value = transformFilePath(value, compilerOptions?.outDir);
        } else if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                if (typeof value[i] === 'string') {
                    value[i] = transformFilePath(value[i], compilerOptions?.outDir);
                }
            }
        }

        input[key] = value as T[keyof T];
    }

    return input;
}
