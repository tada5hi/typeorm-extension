import {Arguments, CommandModule, Argv} from "yargs";

import {
    buildConnectionOptions,
    runDatabaseSeeds,
} from "../../index";

import {ConnectionOptions, createConnection} from "typeorm";
import {createDatabase, dropDatabase} from "../../database";

interface DatabaseSetupArguments extends Arguments {
    connection: 'default' | string,
    transaction: 'all' | 'none' | 'false' | 'each' | 'default',
    config: 'ormconfig' | string,
    database: 'create' | 'drop' | 'none',
    migration: 'run' | 'revert',
    seed: 'run' | 'none'
}

export class DatabaseSetupCommand implements CommandModule {
    command = "db:setup";
    describe = "Run database setup.";

    builder(args: Argv) {
        return args
            .option("connection", {
                alias: "c",
                default: "default",
                describe: "Name of the connection on which run a query."
            })
            .option("transaction", {
                alias: "t",
                default: "default",
                describe: "Indicates if transaction should be used or not for migration run. Enabled by default."
            })
            .option("config", {
                alias: "f",
                default: "ormconfig",
                describe: "Name of the file with connection configuration."
            })

            .option("database", {
                alias: "d",
                default: "create",
                describe: "Create or drop database with schema.",
                choices: ["create", "drop", "none"]
            })
            .option("migration", {
                alias: "m",
                default: "run",
                describe: "Runs all pending migrations.",
                choices: ["run", "revert", "none"]
            })
            .option("seed", {
                alias: "s",
                default: "run",
                describe: "Create initial database sets.",
                choices: ["run", "none"]
            })

    }

    async handler(args: DatabaseSetupArguments, exitProcess: boolean = true) {
        const connectionOptions : ConnectionOptions = await buildConnectionOptions(
            args.connection,
            args.config as string,
            true
        );

        try {
            switch (args.database) {
                case "create":
                    await createDatabase(connectionOptions);
                    break;
                case "drop":
                    await dropDatabase(connectionOptions);
                    if(exitProcess) {
                        process.exit(0);
                    } else {
                        return;
                    }
                    break;
            }

            const options = {
                transaction: connectionOptions.migrationsTransactionMode ?? "all",
            };

            switch (args.transaction) {
                case "all":
                    options.transaction = "all";
                    break;
                case "none":
                case "false":
                    options.transaction = "none";
                    break;
                case "each":
                    options.transaction = "each";
                    break;
                default:
                // noop
            }

            const connection = await createConnection(connectionOptions);

            if(args.database === 'create') {
                await connection.synchronize(false);
            }

            switch (args.migration) {
                case "run":
                    await connection.runMigrations(options);
                    break;
                case "revert":
                    await connection.undoLastMigration(options);
                    if(exitProcess) {
                        process.exit(0);
                    } else {
                        return;
                    }
                    break;
            }

            switch (args.seed) {
                case "run":
                    await runDatabaseSeeds(connection, connectionOptions);
                    break;
            }

            if(exitProcess) {
                process.exit(0);
            } else {
                return;
            }
        } catch (e) {
            if(exitProcess) {
                console.log(e);
                process.exit(1);
            } else {
                throw e;
            }
        }
    }
}

