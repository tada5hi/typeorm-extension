import { merge } from 'smob';
import type { DataSourceOptions } from 'typeorm';

export function mergeDataSourceOptions(
    target: DataSourceOptions,
    source: DataSourceOptions,
) {
    if (target.type !== source.type) {
        return target;
    }

    return merge(target, source);
}
