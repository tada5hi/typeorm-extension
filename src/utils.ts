import {CompilerOptions, convertCompilerOptionsFromJson} from "typescript";
import path from "path";

export function hasOwnProperty<X extends {}, Y extends PropertyKey>(obj: X, prop: Y): obj is X & Record<Y, unknown> {
    return obj.hasOwnProperty(prop);
}

let isTsNode: boolean | undefined;

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

let compilerOptions: CompilerOptions | undefined;

export function getCompilerOptions() {
    if (typeof compilerOptions !== 'undefined') {
        return compilerOptions;
    }

    const filePath: string = path.join(process.cwd(), 'tsconfig.json');
    const tsConfig = require(filePath);

    compilerOptions = tsConfig.compilerOptions ?
        convertCompilerOptionsFromJson(tsConfig.compilerOptions, process.cwd()).options :
        {};

    return compilerOptions;
}
