import {Arguments, Argv, CommandModule} from "yargs";
import {ConnectionOptions, createConnection} from "typeorm";
import {buildConnectionOptions} from "../../../connection";
import {createDatabase, CustomOptions} from "../../../database";

export interface DatabaseCreateArguments extends Arguments {
    root: string;
    connection: 'default' | string;
    config: 'ormconfig' | string;
    synchronize: string;
    initialDatabase?: unknown;
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
            .option('initialDatabase', {
                describe: "Specify the initial database to connect to."
            });
    }

    async handler(args: DatabaseCreateArguments, exitProcess: boolean = true) {
        const connectionOptions: ConnectionOptions = await buildConnectionOptions({
            name: args.connection,
            configName: args.config,
            root: args.root,
            buildForCommand: true,
        });

        const customOptions : CustomOptions = {
            ifNotExist: true
        };

        if(
            typeof args.initialDatabase === 'string' &&
            args.initialDatabase !== ""
        ) {
            customOptions.initialDatabase = args.initialDatabase;
        }

        await createDatabase(customOptions, connectionOptions);

        if (args.synchronize !== "yes") {
            if(exitProcess) {
                process.exit(0);
            }

            return;
        }

        try {
            const connection = await createConnection(connectionOptions);
            await connection.synchronize(false);

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
