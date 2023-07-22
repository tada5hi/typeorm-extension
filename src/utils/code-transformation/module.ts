import process from 'node:process';
import { CodeTransformation } from './constants';

export function detectCodeTransformation() : `${CodeTransformation}` {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (process[Symbol.for('ts-node.register.instance')]) {
        return CodeTransformation.JUST_IN_TIME;
    }

    return CodeTransformation.NONE;
}

export function isCodeTransformation(input: string) {
    return detectCodeTransformation() === input;
}
