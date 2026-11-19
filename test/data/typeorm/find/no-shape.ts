import { DataSource } from 'typeorm';

export { DataSource };

export class Entity {
    constructor() {
        throw new Error('A class must not be called.');
    }
}

export function build(name: string) {
    throw new Error(`A function with parameters must not be called (${name}).`);
}

export function createValue() {
    return { value: 1 };
}

export const settings = { type: 1 };
