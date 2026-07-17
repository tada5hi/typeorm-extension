import { DriverError, OptionsError } from '../../../errors';
import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    IDatabaseDialect,
    IFileSystem,
} from '../type';
import { resolveSQLiteDatabaseDirectory, resolveSQLiteDatabasePath } from './path';

/**
 * better-sqlite3 never opens a server connection —
 * create/drop are filesystem effects following SQL database semantics:
 * create produces the file (or fails when it exists, unless ifNotExist),
 * drop removes it (or fails when it is missing, unless ifExist).
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

        const filePath = resolveSQLiteDatabasePath(operation.params.database, this.cwd);
        const directoryPath = resolveSQLiteDatabaseDirectory(operation.params.database, this.cwd);

        await this.fs.assertDirectoryWritable(directoryPath);

        if (operation.ifNotExist && await this.fs.isFileWritable(filePath)) {
            return undefined;
        }

        await this.fs.createFile(filePath);

        return undefined;
    }

    async drop(operation: DatabaseDropOperation): Promise<unknown> {
        if (!operation.params.database) {
            throw OptionsError.databaseNotDefined();
        }

        const filePath = resolveSQLiteDatabasePath(operation.params.database, this.cwd);

        const removed = await this.fs.removeFile(filePath);

        if (!removed && !operation.ifExist) {
            throw DriverError.databaseNotFound(operation.params.database);
        }

        return undefined;
    }
}
