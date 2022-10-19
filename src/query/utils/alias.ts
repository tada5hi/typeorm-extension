import { RelationsApplyOutput } from '../parameter';

export function getAliasForPath(items?: RelationsApplyOutput, path?: string) {
    if (typeof path === 'undefined' || typeof items === 'undefined') {
        return undefined;
    }

    for (let i = 0; i < items.length; i++) {
        if (items[i].key === path) {
            return items[i].value;
        }
    }

    return undefined;
}
