import { Brackets } from 'typeorm';
import type {
    DataSource,
    EntityTarget,
    ObjectLiteral,
    WhereExpressionBuilder,
} from 'typeorm';
import { useDataSource } from '../../data-source';
import { pickRecord } from '../../utils';
import { getEntityMetadata } from './metadata';

type EntityUniquenessCheckOptions<T> = {
    /**
     * Repository entity class.
     */
    entityTarget: EntityTarget<T>,

    /**
     * Entity to insert/update.
     */
    entity: Partial<T>,

    /**
     * Entity found.
     */
    entityExisting?: Partial<T> | null,

    /**
     * DataSource to use
     */
    dataSource?: DataSource
};

function transformUndefinedToNull<T>(input: undefined | T) : T {
    if (typeof input === 'undefined') {
        return null as T;
    }

    return input;
}

function applyWhereExpression(
    qb: WhereExpressionBuilder,
    data: Record<string, any>,
    type: 'source' | 'target',
) {
    const keys = Object.keys(data);
    for (const key of keys) {
        const value = transformUndefinedToNull(data[key]);

        if (value === null) {
            if (type === 'target') {
                qb.andWhere(`${key} IS NULL`);
            } else {
                qb.andWhere(`${key} IS NOT NULL`);
            }

            continue;
        }

        const bindingKey = `filter_${type}_${key}`;
        const operator = type === 'target' ? '=' : '!=';

        qb.andWhere(`${key} ${operator} :${bindingKey}`, { [bindingKey]: value });
    }
}

/**
 * Check if a given entity does not already exist.
 * Composite unique keys on a null column can only be present once.
 *
 * @experimental
 * @param options
 */
export async function isEntityUnique<T extends ObjectLiteral>(
    options: EntityUniquenessCheckOptions<T>,
) : Promise<boolean> {
    const dataSource = options.dataSource || await useDataSource();

    const metadata = await getEntityMetadata(options.entityTarget, dataSource);

    const repository = dataSource.getRepository(metadata.target);

    const primaryColumnNames = metadata.primaryColumns.map((c) => c.propertyName);

    const columnGroups : string[][] = [];
    if (
        metadata.ownUniques &&
        metadata.ownUniques.length > 0
    ) {
        for (let i = 0; i < metadata.ownUniques.length; i++) {
            columnGroups.push(metadata.ownUniques[i].columns.map(
                (column) => column.propertyName,
            ));
        }
    } else {
        for (let i = 0; i < metadata.indices.length; i++) {
            const index = metadata.indices[i];
            if (!index.isUnique || index.entityMetadata.target !== metadata.target) {
                continue;
            }

            columnGroups.push(index.columns.map(
                (column) => column.propertyName,
            ));
        }
    }

    for (const columnGroup of columnGroups) {
        const queryBuilder = repository.createQueryBuilder('entity');
        queryBuilder.where(new Brackets((qb) => {
            applyWhereExpression(qb, pickRecord(options.entity, columnGroup), 'target');
        }));

        if (options.entityExisting) {
            queryBuilder.andWhere(new Brackets((qb) => {
                applyWhereExpression(qb, pickRecord(options.entityExisting!, primaryColumnNames), 'source');
            }));
        }

        const entity = await queryBuilder.getOne();
        if (entity) {
            return false;
        }
    }

    return true;
}
