import fs from 'fs';

export async function loadJsonFile(filePath: string) : Promise<unknown | undefined> {
    try {
        const file = await fs.promises.readFile(filePath);
        return JSON.parse(file.toString('utf-8'));
    } catch (e) {
        return undefined;
    }
}
