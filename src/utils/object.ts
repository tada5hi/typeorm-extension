export function pickRecord(data: Record<string, any>, keys: string[]) {
    const output : Record<string, any> = {};
    for (const key of keys) {
        output[key] = data[key];
    }

    return output;
}

export function extendObject<T extends Record<string, any>>(
    target: T,
    source: Partial<T>,
) : T {
    const keys = Object.keys(source);
    for (const key of keys) {
        target[key as keyof T] = source[key] as T[keyof T];
    }

    return target;
}
