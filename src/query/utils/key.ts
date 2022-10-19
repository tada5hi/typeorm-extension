export function buildKeyWithPrefix(name: string, prefix?: string) {
    if (prefix) {
        return `${prefix}.${name}`;
    }

    return name;
}
