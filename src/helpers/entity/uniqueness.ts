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

/**
 * Build the where expression for a set of column values.
 *
 * The target expression matches the row which the write would produce, so its
 * conditions are combined with AND. The source expression is the negation of
 * one such match, used to exclude the row which is being updated from the
 * result, so its conditions are combined with OR. Combining them with AND
 * would only exclude a row which differs in every single column, and a
 * composite primary key sharing one column with it would slip through.
 */
function applyWhereExpression(
    qb: WhereExpressionBuilder,
    alias: string,
    data: Record<string, any>,
    type: 'source' | 'target',
) {
    const keys = Object.keys(data);
    for (const [index, key] of keys.entries()) {
        const value = transformUndefinedToNull(data[key]);

        // The alias prefix lets the query builder translate the property name
        // to the column name of the database.
        const propertyPath = `${alias}.${key}`;

        if (value === null) {
            if (type === 'target') {
                qb.andWhere(`${propertyPath} IS NULL`);
            } else {
                qb.orWhere(`${propertyPath} IS NOT NULL`);
            }

            continue;
        }

        const bindingKey = `filter_${type}_${index}`;

        if (type === 'target') {
            qb.andWhere(`${propertyPath} = :${bindingKey}`, { [bindingKey]: value });

            continue;
        }

        qb.orWhere(`${propertyPath} != :${bindingKey}`, { [bindingKey]: value });
    }
}

/**
 * Resolve the values a unique column group will hold after the write.
 *
 * A value provided by the input entity wins. If the input does not define the
 * column and an existing entity is given, the persisted value is kept, because
 * an update leaves that column untouched. Otherwise the column will be null.
 */
function resolveColumnGroupValues<T extends ObjectLiteral>(
    columnGroup: string[],
    entity: Partial<T>,
    entityExisting?: Partial<T> | null,
) : Record<string, any> {
    const output : Record<string, any> = {};

    for (const key of columnGroup) {
        if (typeof entity[key] !== 'undefined') {
            output[key] = entity[key];

            continue;
        }

        if (
            entityExisting &&
            typeof entityExisting[key] !== 'undefined'
        ) {
            output[key] = entityExisting[key];

            continue;
        }

        output[key] = null;
    }

    return output;
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
        const alias = 'entity';
        const queryBuilder = repository.createQueryBuilder(alias);
        queryBuilder.where(new Brackets((qb) => {
            applyWhereExpression(
                qb,
                alias,
                resolveColumnGroupValues(columnGroup, options.entity, options.entityExisting),
                'target',
            );
        }));

        if (options.entityExisting) {
            queryBuilder.andWhere(new Brackets((qb) => {
                applyWhereExpression(qb, alias, pickRecord(options.entityExisting!, primaryColumnNames), 'source');
            }));
        }

        const entity = await queryBuilder.getOne();
        if (entity) {
            return false;
        }
    }

    return true;
}
