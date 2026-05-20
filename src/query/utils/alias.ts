import type { QueryRelationsApplyOutput } from '../parameter';

export function getAliasForPath(items?: QueryRelationsApplyOutput, path?: string) {
    if (typeof path === 'undefined' || typeof items === 'undefined') {
        return undefined;
    }

    for (const item of items) {
        if (item.key === path) {
            return item.value;
        }
    }

    return undefined;
}
