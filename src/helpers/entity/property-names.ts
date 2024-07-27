import type { ObjectLiteral } from 'rapiq';
import { Repository } from 'typeorm';
import type { DataSource, EntityMetadata, EntityTarget } from 'typeorm';
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
    let entityMetadata : EntityMetadata;
    if (input instanceof Repository) {
        entityMetadata = input.metadata;
    } else {
        entityMetadata = await getEntityMetadata(input, dataSource);
    }

    const items : string[] = [];

    for (let i = 0; i < entityMetadata.columns.length; i++) {
        items.push(entityMetadata.columns[i].propertyName);
    }

    for (let i = 0; i < entityMetadata.relations.length; i++) {
        items.push(entityMetadata.relations[i].propertyName);
    }

    return items;
}
