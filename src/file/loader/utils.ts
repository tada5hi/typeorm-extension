import path from 'path';
import { LocatorInfo } from '../locator';

export function buildLoaderFilePath(info: LocatorInfo) {
    return path.join(info.path, info.fileName) +
        (info.fileExtension === '.json' ? '.json' : '');
}
