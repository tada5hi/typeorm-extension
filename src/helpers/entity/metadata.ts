import { Repository } from 'typeorm';
import type {
    DataSource, EntityMetadata, EntityTarget,
    ObjectLiteral,
} from 'typeorm';
import { useDataSource } from '../../data-source';

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

    const index = dataSource.entityMetadatas.findIndex(
        (entityMetadata) => entityMetadata.target === input,
    );

    if (index === -1) {
        throw new Error(`The entity ${input} is not registered.`);
    }

    return dataSource.entityMetadatas[index];
}
