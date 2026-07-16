import type { IFileSystem } from '../../../src/database/core';

export class MemoryFileSystem implements IFileSystem {
    writableDirectories = new Set<string>();

    files = new Set<string>();

    removed: string[] = [];

    async assertDirectoryWritable(path: string): Promise<void> {
        if (!this.writableDirectories.has(path)) {
            throw new Error(`The directory ${path} is not writable.`);
        }
    }

    async isFileWritable(path: string): Promise<boolean> {
        return this.files.has(path);
    }

    async removeFile(path: string): Promise<void> {
        this.files.delete(path);
        this.removed.push(path);
    }
}
