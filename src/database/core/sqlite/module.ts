import { OptionsError } from '../../../errors';
import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    DialectRuntime,
    IDatabaseDialect,
} from '../type';
import { resolveSQLiteDatabaseDirectory, resolveSQLiteDatabasePath } from './path';

/**
 * better-sqlite3 never opens a server connection —
 * create/drop are filesystem effects.
 */
export class SQLiteDialect implements IDatabaseDialect {
    async create(operation: DatabaseCreateOperation, runtime: DialectRuntime): Promise<unknown> {
        if (!operation.params.database) {
            throw OptionsError.databaseNotDefined();
        }

        const directoryPath = resolveSQLiteDatabaseDirectory(operation.params.database, runtime.cwd);

        await runtime.fs.assertDirectoryWritable(directoryPath);

        return undefined;
    }

    async drop(operation: DatabaseDropOperation, runtime: DialectRuntime): Promise<unknown> {
        if (!operation.params.database) {
            throw OptionsError.databaseNotDefined();
        }

        const filePath = resolveSQLiteDatabasePath(operation.params.database, runtime.cwd);

        if (operation.ifExist && await runtime.fs.isFileWritable(filePath)) {
            await runtime.fs.removeFile(filePath);
        }

        return undefined;
    }
}
