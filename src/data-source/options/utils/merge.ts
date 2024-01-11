import { createMerger } from 'smob';
import type { DataSourceOptions } from 'typeorm';

const merge = createMerger({
    strategy: (target, key, value) => {
        if (typeof target[key] === 'undefined') {
            target[key] = value;

            return target;
        }

        return undefined;
    },
});

export function mergeDataSourceOptions(
    target: DataSourceOptions,
    source: DataSourceOptions,
) {
    if (target.type !== source.type) {
        return target;
    }

    return merge(target, source);
}
