import { Repository } from 'typeorm';
import type {
    DataSource,
    EntityMetadata,
    EntityTarget,
    ObjectLiteral,
} from 'typeorm';
import { useDataSource } from '../../data-source';
import { EntityMetadataError } from '../../errors';
import { getEntityName } from './name';

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
        throw EntityMetadataError.notRegistered(getEntityName(input as any));
    }

    return dataSource.getMetadata(input);
}
