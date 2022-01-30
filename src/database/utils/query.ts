/* istanbul ignore next */
import { SelectQueryBuilder } from 'typeorm';

export function existsQuery<T>(builder: SelectQueryBuilder<T>, inverse = false) {
    return `${inverse ? 'not ' : ''}exists (${builder.getQuery()})`;
}
