import {ConnectionOptions, ConnectionOptionsReader} from "typeorm";
import {ConnectionWithSeederOptions, createDefaultSeederOptions, getCompilerOptions} from "../index";
import {ConnectionBuilderOptions} from "./type";
import {modifyConnectionOptionsForRuntimeEnvironment} from "./utils";

export {
    SimpleConnectionOptions
} from "./options";


export * from './type';
export * from './utils';

export async function buildConnectionOptions(
    options?: ConnectionBuilderOptions
) :  Promise<ConnectionWithSeederOptions> {
    options = options ?? {};

    const connectionOptionsReader = new ConnectionOptionsReader({
        root: options.root ?? process.cwd(),
        configName: options.configName ?? 'ormconfig',
    });

    let connectionOptions : ConnectionWithSeederOptions = await connectionOptionsReader.get(options.name ?? 'default');

    /* istanbul ignore next */
    if (options.buildForCommand) {
        Object.assign(connectionOptions, {
            subscribers: [],
            synchronize: false,
            migrationsRun: false,
            dropSchema: false,
            logging: ["query", "error", "schema"]
        } as ConnectionOptions);
    }

    connectionOptions = createDefaultSeederOptions(connectionOptions);

    let distDirectory : string | undefined;

    try {
        const tsCompilerOptions = await getCompilerOptions(options.tsConfigDirectory);
        distDirectory = tsCompilerOptions.outDir;
    } catch (e) {
        //
    }

    modifyConnectionOptionsForRuntimeEnvironment(connectionOptions, {
        distDirectory: distDirectory
    });

    return connectionOptions;
}

