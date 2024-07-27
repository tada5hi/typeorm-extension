export function pickRecord(data: Record<string, any>, keys: string[]) {
    const output : Record<string, any> = {};
    for (let i = 0; i < keys.length; i++) {
        output[keys[i]] = data[keys[i]];
    }

    return output;
}
