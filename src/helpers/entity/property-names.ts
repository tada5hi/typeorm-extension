import type { 
    DataSource, 
    EntityMetadata, 
    EntityTarget, 
    ObjectLiteral, 
    Repository, 
} from 'typeorm';
import { getEntityMetadata } from './metadata';

/**
 * Get (relation-) property names of a given entity.
 *
 * @experimental
 * @param input
 * @param dataSource
 */
export async function getEntityPropertyNames<T extends ObjectLiteral>(
    input: EntityTarget<T> | Repository<T>,
    dataSource?: DataSource,
) : Promise<string[]> {
    const entityMetadata : EntityMetadata = await getEntityMetadata(input, dataSource);

    const items : string[] = [];

    for (let i = 0; i < entityMetadata.columns.length; i++) {
        items.push(entityMetadata.columns[i].propertyName);
    }

    for (let i = 0; i < entityMetadata.relations.length; i++) {
        items.push(entityMetadata.relations[i].propertyName);
    }

    return items;
}
