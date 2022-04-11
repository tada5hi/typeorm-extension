import path from 'path';
import fs from 'fs';
import { LocatorInfo, LocatorOptions } from './type';

export async function locateFile(
    fileName: string,
    options: LocatorOptions,
) : Promise<LocatorInfo | undefined> {
    for (let i = 0; i < options.paths.length; i++) {
        const filePath = path.join(options.paths[i], fileName);

        for (let j = 0; j < options.extensions.length; j++) {
            const filePathWithExtension = filePath + options.extensions[j];

            try {
                await fs.promises.access(filePathWithExtension, fs.constants.R_OK | fs.constants.F_OK);

                return {
                    path: options.paths[i],
                    fileName,
                    fileExtension: options.extensions[j],
                };
            } catch (e) {
                // do nothing ;)
            }
        }
    }

    return undefined;
}
