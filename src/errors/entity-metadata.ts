import { TypeormExtensionError } from './base';

export class EntityMetadataError extends TypeormExtensionError {
    constructor(message?: string) {
        super(message || 'An entity metadata related error has occurred');
    }

    static notRegistered(name: string) {
        return new EntityMetadataError(`The entity ${name} is not registered.`);
    }
}
