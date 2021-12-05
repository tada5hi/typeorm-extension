import { CompilerOptions, convertCompilerOptionsFromJson } from 'typescript';
import path from 'path';

export function hasOwnProperty<X extends Record<string, any>, Y extends PropertyKey>(obj: X, prop: Y): obj is X & Record<Y, unknown> {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

let isTsNode: boolean | undefined;

/* istanbul ignore next */
export function isTsNodeRuntimeEnvironment() {
    if (typeof isTsNode !== 'undefined') {
        return isTsNode;
    }

    isTsNode = false;

    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (process[Symbol.for('ts-node.register.instance')]) {
            isTsNode = true;
        }
    } finally {
        // ...
    }

    return isTsNode;
}

const compilerOptions: Record<string, CompilerOptions | Error | undefined> = {};

/* istanbul ignore next */
export async function getCompilerOptions(directory?: string) : Promise<CompilerOptions | undefined> {
    let fileDirectoryPath : string = directory ?? process.cwd();
    fileDirectoryPath = path.isAbsolute(fileDirectoryPath) ?
        fileDirectoryPath :
        path.join(process.cwd(), fileDirectoryPath);

    if (hasOwnProperty(compilerOptions, fileDirectoryPath)) {
        if (compilerOptions[fileDirectoryPath] instanceof Error) {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw compilerOptions[fileDirectoryPath];
        }

        return compilerOptions[fileDirectoryPath] as CompilerOptions;
    }

    const filePath: string = fileDirectoryPath.includes('.json') ?
        fileDirectoryPath :
        path.join(fileDirectoryPath, 'tsconfig.json');

    try {
        const tsConfig = await import(filePath);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        compilerOptions[fileDirectoryPath] = tsConfig.compilerOptions ?
            convertCompilerOptionsFromJson(tsConfig.compilerOptions, process.cwd()).options :
            {};
    } catch (e) {
        if (e instanceof Error) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            compilerOptions[fileDirectoryPath] = e;
        }

        throw e;
    }

    return compilerOptions[fileDirectoryPath] as CompilerOptions;
}
