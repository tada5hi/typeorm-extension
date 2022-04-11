import { LocatorInfo } from '../locator';
import {
    loadJsonFile, loadScriptFile,
} from './file-type';
import { buildLoaderFilePath } from './utils';

export async function loadFile(info?: LocatorInfo) : Promise<unknown | undefined> {
    if (!info) return undefined;

    const filePath = buildLoaderFilePath(info);

    if (info.fileExtension === '.json') {
        return loadJsonFile(filePath);
    }

    return loadScriptFile(filePath);
}
