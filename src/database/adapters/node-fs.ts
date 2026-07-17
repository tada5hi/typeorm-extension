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
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return false;
            }

            throw error;
        }
    }

    async createFile(path: string): Promise<void> {
        await fs.promises.writeFile(path, '', { flag: 'wx' });
    }

    async removeFile(path: string): Promise<boolean> {
        try {
            await fs.promises.unlink(path);
            return true;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return false;
            }

            throw error;
        }
    }
}
