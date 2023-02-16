/* istanbul ignore next */
import type { ObjectLiteral } from 'rapiq';
import type { SelectQueryBuilder } from 'typeorm';

export function existsQuery<T extends ObjectLiteral = ObjectLiteral>(builder: SelectQueryBuilder<T>, inverse = false) {
    return `${inverse ? 'not ' : ''}exists (${builder.getQuery()})`;
}
