import { getFileNameExtension } from 'locter';

export function buildSeederFileName(
    name: string,
    timestamp: number,
    options: { javascript?: boolean } = {},
): string {
    if (getFileNameExtension(name)) {
        return `${timestamp}-${name}`;
    }

    return `${timestamp}-${name}${options.javascript ? '.js' : '.ts'}`;
}
