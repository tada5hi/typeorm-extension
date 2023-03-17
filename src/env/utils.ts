import process from 'node:process';
import { hasOwnProperty } from '../utils';

export function hasProcessEnv(key: string) : boolean {
    return hasOwnProperty(process.env, key);
}

export function readFromProcessEnv(key: string) : string | undefined;
export function readFromProcessEnv<T>(key: string, alt: T) : T | string;
export function readFromProcessEnv<T>(key: string, alt?: T): any {
    if (hasOwnProperty(process.env, key)) {
        return process.env[key];
    }

    return alt;
}
