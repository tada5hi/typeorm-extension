import type { ObjectLiteral } from 'rapiq';
import type { DataSource, EntityTarget, FindOptionsWhere } from 'typeorm';
import { useDataSource } from '../../data-source';
import { EntityRelationLookupError } from './error';
import { getEntityMetadata } from './metadata';

type EntityRelationColumnsValidateOptions<T> = {
    dataSource?: DataSource,
    entityTarget: EntityTarget<T>,
};

/**
 * Validate join columns of a given entity.
 * It will look up and append the referenced entities to the input entity.
 *
 * @experimental
 * @param entity
 * @param options
 */
export async function validateEntityJoinColumns<T extends ObjectLiteral>(
    entity: Partial<T>,
    options: EntityRelationColumnsValidateOptions<T>,
) {
    const dataSource = options.dataSource || await useDataSource();
    const entityMetadata = await getEntityMetadata(options.entityTarget, dataSource);

    const relations : Partial<T> = {};
    for (let i = 0; i < entityMetadata.relations.length; i++) {
        const relation = entityMetadata.relations[i];

        let skipRelation : boolean = false;

        const where : FindOptionsWhere<ObjectLiteral> = {};
        const columns : string[] = [];
        for (let j = 0; j < relation.joinColumns.length; j++) {
            const joinColumn = relation.joinColumns[j];
            if (typeof entity[joinColumn.propertyName] === 'undefined') {
                continue;
            }

            if (
                joinColumn.isNullable &&
                entity[joinColumn.propertyName] === null
            ) {
                skipRelation = true;
                break;
            }

            if (joinColumn.referencedColumn) {
                where[joinColumn.referencedColumn.propertyName] = entity[joinColumn.propertyName];

                columns.push(joinColumn.propertyName);
            } else {
                throw EntityRelationLookupError.notReferenced(
                    relation.propertyName,
                    [joinColumn.propertyName],
                );
            }
        }

        if (skipRelation || columns.length === 0) {
            continue;
        }

        const repository = dataSource.getRepository(relation.type);
        const item = await repository.findOne({
            where,
        });

        if (!item) {
            throw EntityRelationLookupError.notFound(relation.propertyName, columns);
        }

        relations[relation.propertyName as keyof T] = item as T[keyof T];
    }

    const relationKeys = Object.keys(relations);
    for (let i = 0; i < relationKeys.length; i++) {
        const relationKey = relationKeys[i];

        entity[relationKey as keyof T] = relations[relationKey] as T[keyof T];
    }

    return entity;
}
