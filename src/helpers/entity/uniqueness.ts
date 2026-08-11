import { Brackets } from 'typeorm';
import type {
    DataSource,
    EntityTarget,
    ObjectLiteral,
    WhereExpressionBuilder,
} from 'typeorm';
import { useDataSource } from '../../data-source';
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
 * Read the value of a column property path.
 *
 * The path of a column of an embedded entity is nested (profile.email), so it
 * can not be used as a plain key. A path which is not reachable counts as
 * absent, like a column the input does not define at all.
 */
function readPropertyPath(data: Record<string, any>, path: string) : unknown {
    const parts = path.split('.');

    let current : any = data;
    for (const part of parts) {
        if (
            current === null ||
            typeof current !== 'object'
        ) {
            return undefined;
        }

        current = current[part];
    }

    return current;
}

function pickPropertyPaths(data: Record<string, any>, paths: string[]) : Record<string, any> {
    const output : Record<string, any> = {};
    for (const path of paths) {
        output[path] = readPropertyPath(data, path);
    }

    return output;
}

/**
 * Prefixing the property with the query alias is what lets the query builder
 * translate it to the column name of the database.
 */
function buildPropertyPath(alias: string, key: string) : string {
    return `${alias}.${key}`;
}

/**
 * Match the row which the write would produce: every column has to hold the
 * given value, so the conditions are combined with AND.
 */
function applyMatchExpression(
    qb: WhereExpressionBuilder,
    alias: string,
    data: Record<string, any>,
) {
    const keys = Object.keys(data);
    for (const [index, key] of keys.entries()) {
        const value = transformUndefinedToNull(data[key]);
        const propertyPath = buildPropertyPath(alias, key);

        if (value === null) {
            qb.andWhere(`${propertyPath} IS NULL`);

            continue;
        }

        const bindingKey = `match_${index}`;

        qb.andWhere(`${propertyPath} = :${bindingKey}`, { [bindingKey]: value });
    }
}

/**
 * Exclude one specific row, identified by the given columns.
 *
 * This is the negation of a match, and the negation of a conjunction is a
 * disjunction: a row is a different one as soon as a single column differs.
 * Combining the conditions with AND instead would only exclude a row which
 * differs in every column, so a row sharing one column of a composite primary
 * key with the excluded one would be dropped from the result as well.
 */
function applyExclusionExpression(
    qb: WhereExpressionBuilder,
    alias: string,
    data: Record<string, any>,
) {
    const keys = Object.keys(data);
    for (const [index, key] of keys.entries()) {
        const value = transformUndefinedToNull(data[key]);
        const propertyPath = buildPropertyPath(alias, key);

        if (value === null) {
            qb.orWhere(`${propertyPath} IS NOT NULL`);

            continue;
        }

        const bindingKey = `exclude_${index}`;

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

    for (const path of columnGroup) {
        const value = readPropertyPath(entity, path);
        if (typeof value !== 'undefined') {
            output[path] = value;

            continue;
        }

        const valueExisting = entityExisting ?
            readPropertyPath(entityExisting, path) :
            undefined;
        if (typeof valueExisting !== 'undefined') {
            output[path] = valueExisting;

            continue;
        }

        output[path] = null;
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

    const primaryColumnPaths = metadata.primaryColumns.map((c) => c.propertyPath);

    const columnGroups : string[][] = [];
    if (
        metadata.ownUniques &&
        metadata.ownUniques.length > 0
    ) {
        for (let i = 0; i < metadata.ownUniques.length; i++) {
            columnGroups.push(metadata.ownUniques[i].columns.map(
                (column) => column.propertyPath,
            ));
        }
    } else {
        for (let i = 0; i < metadata.indices.length; i++) {
            const index = metadata.indices[i];
            if (!index.isUnique || index.entityMetadata.target !== metadata.target) {
                continue;
            }

            columnGroups.push(index.columns.map(
                (column) => column.propertyPath,
            ));
        }
    }

    for (const columnGroup of columnGroups) {
        const alias = 'entity';
        const queryBuilder = repository.createQueryBuilder(alias);
        queryBuilder.where(new Brackets((qb) => {
            applyMatchExpression(
                qb,
                alias,
                resolveColumnGroupValues(columnGroup, options.entity, options.entityExisting),
            );
        }));

        if (options.entityExisting) {
            queryBuilder.andWhere(new Brackets((qb) => {
                applyExclusionExpression(qb, alias, pickPropertyPaths(options.entityExisting!, primaryColumnPaths));
            }));
        }

        const entity = await queryBuilder.getOne();
        if (entity) {
            return false;
        }
    }

    return true;
}
