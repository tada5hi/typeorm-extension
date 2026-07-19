import process from 'node:process';
import { CodeTransformation } from './constants';

// matches the bare `tsx` specifier (node --import tsx), optionally with a
// subpath (tsx/esm), as well as resolved paths into the tsx package
// (.../node_modules/tsx/dist/loader.mjs).
const TSX_MARKER_REGEX = /(?:^|=|[\\/])tsx(?:$|[\\/])/;

function isTSXProcess() : boolean {
    if (process.execArgv.some((arg) => TSX_MARKER_REGEX.test(arg))) {
        return true;
    }

    const { _preload_modules: preloadModules } = process as unknown as { _preload_modules?: string[] };

    return Array.isArray(preloadModules) &&
        preloadModules.some((el) => TSX_MARKER_REGEX.test(el));
}

export function detectCodeTransformation() : `${CodeTransformation}` {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (process[Symbol.for('ts-node.register.instance')]) {
        return CodeTransformation.JUST_IN_TIME;
    }

    if (isTSXProcess()) {
        return CodeTransformation.JUST_IN_TIME;
    }

    return CodeTransformation.NONE;
}

export function isCodeTransformation(input: string) {
    return detectCodeTransformation() === input;
}
