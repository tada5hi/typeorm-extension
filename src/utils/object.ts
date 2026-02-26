export function pickRecord(data: Record<string, any>, keys: string[]) {
    const output : Record<string, any> = {};
    for (let i = 0; i < keys.length; i++) {
        output[keys[i]] = data[keys[i]];
    }

    return output;
}

export function extendObject<T extends Record<string, any>>(
    target: T,
    source: Partial<T>,
) : T {
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i++) {
        target[keys[i] as keyof T] = source[keys[i]] as T[keyof T];
    }

    return target;
}
