import { isObject } from 'locter';
import { hasOwnProperty } from '../../utils';

/**
 * Whether the (unknown) error carries the given errno code.
 */
export function hasErrorCode(error: unknown, code: string): boolean {
    return isObject(error) &&
        hasOwnProperty(error, 'code') &&
        error.code === code;
}

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
