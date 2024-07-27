import { FilterComparisonOperator } from 'rapiq';
import type { FiltersParseOutputElement } from 'rapiq';
import { Brackets } from 'typeorm';
import type {
    DataSource, EntityTarget, ObjectLiteral, WhereExpressionBuilder,
} from 'typeorm';
import { useDataSource } from '../../data-source';
import { applyFiltersTransformed, transformParsedFilters } from '../../query';
import { pickRecord } from '../../utils';
import { getEntityMetadata } from './metadata';

type EntityUniquenessCheckOptions<T> = {
    entityTarget: EntityTarget<T>,
    entity: Partial<T>,
    entityExisting?: Partial<T>,
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
    const elements : FiltersParseOutputElement[] = [];

    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
        elements.push({
            key: keys[i],
            value: transformUndefinedToNull(data[keys[i]]),
            operator: type === 'target' ?
                FilterComparisonOperator.EQUAL :
                FilterComparisonOperator.NOT_EQUAL,
        });
    }

    const queryFilters = transformParsedFilters(elements, {
        bindingKey(key) {
            if (type === 'source') {
                return `filter_source_${key}`;
            }

            return `filter_target_${key}`;
        },
    });

    applyFiltersTransformed(qb, queryFilters);

    return queryFilters;
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

    for (let i = 0; i < metadata.ownUniques.length; i++) {
        const uniqueColumnNames = metadata.ownUniques[i].columns.map(
            (column) => column.propertyName,
        );

        const queryBuilder = repository.createQueryBuilder('entity');
        queryBuilder.where(new Brackets((qb) => {
            applyWhereExpression(qb, pickRecord(options.entity, uniqueColumnNames), 'target');
        }));

        queryBuilder.andWhere(new Brackets((qb) => {
            if (options.entityExisting) {
                applyWhereExpression(qb, pickRecord(options.entityExisting, primaryColumnNames), 'source');
            }
        }));

        const entity = await queryBuilder.getOne();
        if (entity) {
            return false;
        }
    }

    return true;
}
