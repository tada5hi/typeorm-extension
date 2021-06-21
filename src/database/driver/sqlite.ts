import path from "path";
import fs from 'fs';

import {SqliteDriver} from "typeorm/driver/sqlite/SqliteDriver";

import {SimpleConnectionOptions} from "../../connection";
import {CustomOptions} from "../type";

export async function createSQLiteDatabase(
    driver: SqliteDriver,
    connectionOptions: SimpleConnectionOptions,
    customOptions: CustomOptions
) {
    const filePath : string = path.isAbsolute(connectionOptions.database) ? connectionOptions.database : path.join(process.cwd(), connectionOptions.database);
    const directoryPath : string = path.dirname(filePath);

    return new Promise(((resolve, reject) => {
          fs.access(directoryPath, fs.constants.W_OK, (err) => {
              if(err) {
                  reject(err);
              }

              resolve(true);
          })
    }));
}

export async function dropSQLiteDatabase(
    driver: SqliteDriver,
    connectionOptions: SimpleConnectionOptions,
    customOptions: CustomOptions
) {
    const filePath : string = path.isAbsolute(connectionOptions.database) ? connectionOptions.database : path.join(process.cwd(), connectionOptions.database);

    return new Promise(((resolve, reject) => {
        fs.access(filePath, fs.constants.F_OK | fs.constants.W_OK, (err) => {
            if (err) {
                reject(err);
            }

            fs.rm(filePath, (e) => {
                if(err) {
                    reject(err);
                }

                resolve(true);
            })

            resolve(true);
        });
    }));
}
