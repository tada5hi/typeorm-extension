import path from 'node:path';

export function resolveSQLiteDatabasePath(database: string, cwd: string): string {
    return path.isAbsolute(database) ?
        database :
        path.join(cwd, database);
}

export function resolveSQLiteDatabaseDirectory(database: string, cwd: string): string {
    return path.dirname(resolveSQLiteDatabasePath(database, cwd));
}
