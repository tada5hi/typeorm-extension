import type { EntitySchema, ObjectType } from 'typeorm';
import { InstanceChecker } from 'typeorm';

export function getEntityName<O>(entity: ObjectType<O> | EntitySchema<O> | string) : string {
    if (typeof entity === 'string') {
        return entity;
    }

    if (typeof entity === 'function') {
        return entity.name;
    }

    if (InstanceChecker.isEntitySchema(entity)) {
        return entity.options.name;
    }

    return new (entity as any)().constructor.name;
}
