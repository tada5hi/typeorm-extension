import process from 'node:process';
import { hasOwnProperty } from '../has-property';
import { CodeTransformation } from './constants';

const envKey = 'TYPEORM_EXTENSION_CODE_TRANSFORMATION';

export function isCodeTransformationValid(input: unknown) : input is CodeTransformation {
    return input === CodeTransformation.JUST_IN_TIME ||
        input === CodeTransformation.NONE;
}
export function setCodeTransformation(input: unknown) : void {
    if (isCodeTransformationValid(input)) {
        process.env[envKey] = input;
    }
}

export function detectCodeTransformation() : `${CodeTransformation}` {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (process[Symbol.for('ts-node.register.instance')]) {
        return CodeTransformation.JUST_IN_TIME;
    }

    if (hasOwnProperty(process.env, envKey)) {
        if (isCodeTransformationValid(process.env[envKey])) {
            return process.env[envKey];
        }
    }

    return CodeTransformation.NONE;
}

export function isCodeTransformation(input: string) {
    return detectCodeTransformation() === input;
}
