import path from "path";
import glob from "glob";

import {Connection, ConnectionOptions} from "typeorm";
export {factory, Seeder} from "typeorm-seeding";

import {hasOwnProperty} from "../utils";
import {ConnectionWithSeedingOptions, SeedingOptions} from "../connection/options";
import {factory} from "typeorm-seeding";

export async function runDatabaseSeeds(connection: Connection, connectionOptions?: ConnectionWithSeedingOptions) {
    const options : ConnectionWithSeedingOptions = connectionOptions ?? connection.options;
    const files : string[] = options.seeds
        .map((pattern) => glob.sync(path.resolve(process.cwd(), pattern)))
        .reduce((acc, el) => acc.concat(el));

    const objects: Record<string, any>[] = await Promise.all(files.map(file => import(file)));

    for (const object of objects) {
        if (hasOwnProperty(object, 'default')) {
            // @ts-ignore
            const clazz: Seeder = new object.default();
            await clazz.run(factory, connection);
        }
    }
}

export function setConnectionOptionsForSeeder(connectionOptions: ConnectionOptions & SeedingOptions) {
    (global as any).TypeORM_Seeding_Connection.ormconfig = connectionOptions;
}


