import { hasOwnProperty } from '../../../utils';

export async function loadScriptFileSingleExport(
    filePath: string,
    filterFn?: (key: string, value: unknown) => boolean,
) : Promise<unknown | undefined> {
    try {
        const data = await import(filePath);
        if (hasOwnProperty(data, 'default')) {
            return data.default;
        }

        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            if (
                filterFn &&
                filterFn(keys[i], data[keys[i]])
            ) {
                return data[keys[i]];
            }
        }

        if (keys.length > 0) {
            return data[keys[0]];
        }

        return undefined;
    } catch (e) {
        return undefined;
    }
}
export async function loadScriptFile(filePath: string) : Promise<unknown | undefined> {
    try {
        return await import(filePath);
    } catch (e) {
        return undefined;
    }
}
