import { isTsNodeRuntimeEnvironment, isTsxRuntimeEnvironment } from 'locter';
import { CodeTransformation } from './constants';

export function detectCodeTransformation() : `${CodeTransformation}` {
    if (
        isTsNodeRuntimeEnvironment() ||
        isTsxRuntimeEnvironment()
    ) {
        return CodeTransformation.JUST_IN_TIME;
    }

    return CodeTransformation.NONE;
}

export function isCodeTransformation(input: string) {
    return detectCodeTransformation() === input;
}
