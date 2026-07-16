import fs from 'node:fs';
import type { IFileSystem } from '../core';

export class NodeFileSystem implements IFileSystem {
    async assertDirectoryWritable(path: string): Promise<void> {
        await fs.promises.access(path, fs.constants.W_OK);
    }

    async isFileWritable(path: string): Promise<boolean> {
        try {
            await fs.promises.access(path, fs.constants.F_OK | fs.constants.W_OK);
            return true;
        } catch {
            return false;
        }
    }

    async removeFile(path: string): Promise<void> {
        await fs.promises.unlink(path);
    }
}
