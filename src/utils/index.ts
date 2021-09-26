import {CompilerOptions, convertCompilerOptionsFromJson} from "typescript";
import path from "path";

export function hasOwnProperty<X extends {}, Y extends PropertyKey>(obj: X, prop: Y): obj is X & Record<Y, unknown> {
    return obj.hasOwnProperty(prop);
}

let isTsNode: boolean | undefined;

/* istanbul ignore next */
export function isTsNodeRuntimeEnvironment() {
    if (typeof isTsNode !== 'undefined') {
        return isTsNode;
    }

    isTsNode = false;

    try {
        // @ts-ignore
        if (process[Symbol.for("ts-node.register.instance")]) {
            isTsNode = true;
        }
    } finally {
        // ...
    }

    return isTsNode;
}

const compilerOptions: Record<string, CompilerOptions | Error | undefined> = {};

/* istanbul ignore next */
export async function getCompilerOptions(directory?: string) {
    let fileDirectoryPath : string = directory ?? process.cwd();
    fileDirectoryPath = path.isAbsolute(fileDirectoryPath) ?
        fileDirectoryPath :
        path.join(process.cwd(), fileDirectoryPath);

    if (compilerOptions.hasOwnProperty(fileDirectoryPath)) {
        if(compilerOptions[fileDirectoryPath] instanceof Error) {
            throw compilerOptions[fileDirectoryPath];
        }

        return compilerOptions[fileDirectoryPath];
    }

    const filePath: string = fileDirectoryPath.includes('.json') ?
        fileDirectoryPath :
        path.join(fileDirectoryPath, 'tsconfig.json');


    try {
        const tsConfig = await import(filePath);

        compilerOptions[fileDirectoryPath] = tsConfig.compilerOptions ?
            convertCompilerOptionsFromJson(tsConfig.compilerOptions, process.cwd()).options :
            {};
    } catch (e) {
        compilerOptions[fileDirectoryPath] = e;

        throw e;
    }

    return compilerOptions[fileDirectoryPath];
}
