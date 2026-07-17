/**
 * Normalize a callback style client (pg, mysql2) query to a promise.
 */
export async function promisifyCallbackQuery(connection: any, query: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
        connection.query(query, (queryErr: any, queryResult: any) => {
            if (queryErr) {
                reject(queryErr);
                return;
            }

            resolve(queryResult);
        });
    });
}
