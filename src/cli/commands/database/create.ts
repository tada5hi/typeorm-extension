import {Arguments, Argv, CommandModule} from "yargs";
import {ConnectionOptions, createConnection} from "typeorm";
import {buildConnectionOptions} from "../../../connection";
import {createDatabase} from "../../../database";

export interface DatabaseCreateArguments extends Arguments {
    root: string,
    connection: 'default' | string,
    config: 'ormconfig' | string,
    synchronize: 'yes' | 'no'
}

export class DatabaseCreateCommand implements CommandModule {
    command = "db:create";
    describe = "Create database.";

    builder(args: Argv) {
        return args
            .option('root', {
                alias: 'r',
                default: process.cwd(),
                describe: 'Path to your typeorm config file',
            })
            .option("connection", {
                alias: "c",
                default: "default",
                describe: "Name of the connection on which run a query."
            })
            .option("config", {
                alias: "f",
                default: "ormconfig",
                describe: "Name of the file with connection configuration."
            })
            .option("synchronize", {
                alias: "s",
                default: "yes",
                describe: "Create database schema for all entities.",
                choices: ["yes", "no"]
            })
    }

    async handler(args: DatabaseCreateArguments, exitProcess: boolean = true) {
        const connectionOptions: ConnectionOptions = await buildConnectionOptions({
            name: args.connection,
            configName: args.config,
            root: args.root,
            buildForCommand: true,
        });

        await createDatabase({
            ifNotExist: true
        }, connectionOptions);

        try {
            const connection = await createConnection(connectionOptions);
            if (args.synchronize === "yes") {
                await connection.synchronize(false);
            }

            if (exitProcess) {
                await connection.close();
                process.exit(0);
            }
        } catch (e) {
            console.log(e);

            if(exitProcess) {
                process.exit(1);
            }
        }
    }
}
