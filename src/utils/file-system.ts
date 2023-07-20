import fs from 'node:fs';

export async function isDirectory(input: string) : Promise<boolean> {
    try {
        const stat = await fs.promises.stat(input);
        return stat.isDirectory();
    } catch (e) {
        return false;
    }
}
