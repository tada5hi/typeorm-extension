import { InstanceChecker, Repository } from 'typeorm';
import type {
    DataSource,
    EntityMetadata,
    EntityTarget,
    ObjectLiteral,
} from 'typeorm';
import { useDataSource } from '../../data-source';
import { EntityMetadataError } from '../../errors';

/**
 * Describe an entity target for an error message.
 *
 * Every representation typeorm accepts has to be covered, and none of them may
 * be constructed to find out: the target of a failed lookup can be anything.
 */
function describeEntityTarget(input: unknown) : string {
    if (typeof input === 'string') {
        return input;
    }

    if (typeof input === 'function') {
        return input.name;
    }

    if (InstanceChecker.isEntitySchema(input)) {
        return input.options.name;
    }

    if (
        typeof input === 'object' &&
        input !== null &&
        typeof (input as { name?: unknown }).name === 'string'
    ) {
        return (input as { name: string }).name;
    }

    return String(input);
}

/**
 * Receive metadata for a given repository or entity-target.
 *
 * @experimental
 * @param input
 * @param dataSource
 */
export async function getEntityMetadata<T extends ObjectLiteral>(
    input: Repository<T> | EntityTarget<T>,
    dataSource?: DataSource,
): Promise<EntityMetadata> {
    if (input instanceof Repository) {
        return input.metadata;
    }

    dataSource = dataSource || await useDataSource();

    // The lookup is delegated to typeorm, so every entity-target
    // representation (class, entity schema, name, ...) is resolved alike.
    if (!dataSource.hasMetadata(input)) {
        throw EntityMetadataError.notRegistered(describeEntityTarget(input));
    }

    return dataSource.getMetadata(input);
}
