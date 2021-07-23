import {CockroachDriver} from "typeorm/driver/cockroachdb/CockroachDriver";
import {SimpleConnectionOptions} from "../../connection";
import {CustomOptions} from "../type";

export async function createSimpleCockroachDBConnection(
    driver: CockroachDriver,
    connectionOptions: SimpleConnectionOptions
) {
    /**
     * pg library
     */
    const {Client} = driver.postgres;
    let options : Record<string, any> = {};

    if(typeof connectionOptions.url === 'string') {
        options.connectionString = connectionOptions.url;
    } else {
        options = {
            host: connectionOptions.host,
            port: connectionOptions.port,
            user: connectionOptions.user,
            password: connectionOptions.password,
            ssl: connectionOptions.ssl
        };
    }

    const client = new Client(options);

    await client.connect();

    return client;
}

export async function executeSimpleCockroachDBQuery(connection: any, query: string, endConnection: boolean = true) {
    return new Promise(((resolve, reject) => {
        connection.query(query, (queryErr: any, queryResult: any) => {
            if(endConnection) {
                connection.end();
            }

            if (queryErr) {
                reject(queryErr);
            }

            resolve(queryResult);
        });
    }));
}

export async function createCockroachDBDatabase(
    driver: CockroachDriver,
    connectionOptions: SimpleConnectionOptions,
    customOptions: CustomOptions
) {
    const connection = await createSimpleCockroachDBConnection(driver, connectionOptions);

    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/cockroachdb/CockroachQueryRunner.ts#L347
     */
    const query = `CREATE DATABASE ${customOptions.ifNotExist ? "IF NOT EXISTS " : ""} "${connectionOptions.database}"`;

    return await executeSimpleCockroachDBQuery(connection, query);
}

export async function dropCockroachDBDatabase(
    driver: CockroachDriver,
    connectionOptions: SimpleConnectionOptions,
    customOptions: CustomOptions
) {
    const connection = await createSimpleCockroachDBConnection(driver, connectionOptions);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/cockroachdb/CockroachQueryRunner.ts#L356
     */
    const query = `DROP DATABASE ${customOptions.ifExist ? "IF EXISTS " : ""} "${connectionOptions.database}"`;

    return await executeSimpleCockroachDBQuery(connection, query);
}
