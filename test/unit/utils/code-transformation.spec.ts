import process from 'node:process';
import {
    afterEach,
    describe,
    expect,
    it,
} from 'vitest';
import { CodeTransformation, detectCodeTransformation, isCodeTransformation } from '../../../src';

const TS_NODE_MARKER = Symbol.for('ts-node.register.instance');

describe('src/utils/code-transformation', () => {
    const execArgv = [...process.execArgv];

    afterEach(() => {
        delete (process as any)[TS_NODE_MARKER];
        process.execArgv = [...execArgv];
        delete (process as any)._preload_modules;
    });

    it('should detect no transformation by default', () => {
        expect(detectCodeTransformation()).toEqual(CodeTransformation.NONE);
        expect(isCodeTransformation(CodeTransformation.JUST_IN_TIME)).toBeFalsy();
    });

    it('should detect ts-node', () => {
        (process as any)[TS_NODE_MARKER] = {};

        expect(detectCodeTransformation()).toEqual(CodeTransformation.JUST_IN_TIME);
    });

    it('should detect the tsx loader in the exec arguments', () => {
        process.execArgv = [
            '--require',
            '/app/node_modules/tsx/dist/preflight.cjs',
            '--import',
            'file:///app/node_modules/tsx/dist/loader.mjs',
        ];

        expect(detectCodeTransformation()).toEqual(CodeTransformation.JUST_IN_TIME);
    });

    it('should detect a bare tsx specifier in the exec arguments', () => {
        process.execArgv = ['--import', 'tsx'];
        expect(detectCodeTransformation()).toEqual(CodeTransformation.JUST_IN_TIME);

        process.execArgv = ['--import=tsx/esm'];
        expect(detectCodeTransformation()).toEqual(CodeTransformation.JUST_IN_TIME);
    });

    it('should detect tsx in the preloaded modules', () => {
        (process as any)._preload_modules = ['/app/node_modules/tsx/dist/preflight.cjs'];

        expect(detectCodeTransformation()).toEqual(CodeTransformation.JUST_IN_TIME);
    });

    it('should not treat unrelated exec arguments as tsx', () => {
        process.execArgv = ['--require', '/app/node_modules/ts-mixer/dist/index.js'];

        expect(detectCodeTransformation()).toEqual(CodeTransformation.NONE);
    });
});
