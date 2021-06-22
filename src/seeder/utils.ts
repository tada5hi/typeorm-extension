import glob from "glob";
import path from "path";
import {SeederConstructor} from "./type";

export function loadFiles(filesPattern: string[]) : string[] {
    return filesPattern
        .map((pattern) => glob.sync(
            path.isAbsolute(pattern) ?
                pattern :
                path.resolve(process.cwd(), pattern)
        ))
        .reduce((acc, el) => acc.concat(el));
}

export async function importSeed(filePath: string): Promise<SeederConstructor> {
    const seedFileObject: { [key: string]: SeederConstructor } = await import(filePath)
    const keys = Object.keys(seedFileObject)
    return seedFileObject[keys[0]]
}
