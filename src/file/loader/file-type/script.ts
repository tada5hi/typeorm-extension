import { hasOwnProperty } from '../../../utils';

export async function loadScriptFile(filePath: string) : Promise<unknown | undefined> {
    try {
        let data = await import(filePath);
        if (hasOwnProperty(data, 'default')) {
            data = data.default;
        }

        return data;
    } catch (e) {
        return undefined;
    }
}
