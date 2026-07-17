import { OptionsError } from '../../../errors';
import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    IDatabaseDialect,
    IFileSystem,
} from '../type';
import { resolveSQLiteDatabaseDirectory, resolveSQLiteDatabasePath } from './path';

/**
 * better-sqlite3 never opens a server connection —
 * create/drop are filesystem effects.
 */
export class SQLiteDialect implements IDatabaseDialect {
    constructor(
        protected fs: IFileSystem,
        protected cwd: string,
    ) {
        this.fs = fs;
        this.cwd = cwd;
    }

    async create(operation: DatabaseCreateOperation): Promise<unknown> {
        if (!operation.params.database) {
            throw OptionsError.databaseNotDefined();
        }

        const directoryPath = resolveSQLiteDatabaseDirectory(operation.params.database, this.cwd);

        await this.fs.assertDirectoryWritable(directoryPath);

        return undefined;
    }

    async drop(operation: DatabaseDropOperation): Promise<unknown> {
        if (!operation.params.database) {
            throw OptionsError.databaseNotDefined();
        }

        const filePath = resolveSQLiteDatabasePath(operation.params.database, this.cwd);

        if (operation.ifExist && await this.fs.isFileWritable(filePath)) {
            await this.fs.removeFile(filePath);
        }

        return undefined;
    }
}
