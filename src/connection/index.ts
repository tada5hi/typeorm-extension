import {ConnectionOptions, ConnectionOptionsReader} from "typeorm";
import path from 'path';
import {getCompilerOptions, isTsNodeRuntimeEnvironment, setConnectionOptionsForSeeder} from "../index";
import {ConnectionWithSeedingOptions} from "./options";

export {
    SimpleConnectionOptions,
    ConnectionWithSeedingOptions,
    SeedingOptions
} from "./options";

export async function buildConnectionOptions(
    name : string = 'default',
    config: string = 'ormconfig',
    isUsedByCommand: boolean = false
) :  Promise<ConnectionWithSeedingOptions> {
    const connectionOptionsReader = new ConnectionOptionsReader({
        root: process.cwd(),
        configName: config
    });

    const connectionOptions : ConnectionWithSeedingOptions = await connectionOptionsReader.get(name);

    if (isUsedByCommand) {
        Object.assign(connectionOptions, {
            subscribers: [],
            synchronize: false,
            migrationsRun: false,
            dropSchema: false,
            logging: ["query", "error", "schema"]
        } as ConnectionOptions);
    }

    if (!connectionOptions.factories) {
        connectionOptions.factories = [process.env.TYPEORM_SEEDING_FACTORIES || 'src/database/factories/**/*{.ts,.js}']
    }
    if (!connectionOptions.seeds) {
        connectionOptions.seeds = [process.env.TYPEORM_SEEDING_SEEDS || 'src/database/seeds/**/*{.ts,.js}']
    }

    modifyConnectionOptionsForRuntimeEnvironment(connectionOptions);
    setConnectionOptionsForSeeder(connectionOptions);

    return connectionOptions;
}

export function modifyConnectionOptionsForRuntimeEnvironment(
    connectionOptions: ConnectionWithSeedingOptions,
) {
    const keys : Extract<keyof ConnectionWithSeedingOptions, 'entities' | 'subscribers' | 'seeds' | 'factories'>[] = [
        'entities',
        'subscribers',
        'seeds',
        'factories'
    ];

    for(let i=0; i<keys.length; i++) {
        connectionOptions = modifyConnectionOptionForRuntimeEnvironment(connectionOptions, keys[i]);
    }

    return connectionOptions;
}

export function modifyConnectionOptionForRuntimeEnvironment(
    connectionOptions: ConnectionWithSeedingOptions,
    key: keyof ConnectionWithSeedingOptions,
    compilerSrcDirectory?: string
) {
    switch (key) {
        case "entities":
        case "subscribers":
        case "seeds":
        case "factories":
            const isTsNodeEnv = isTsNodeRuntimeEnvironment();
            if(!isTsNodeEnv) {
                const tsCompilerOptions = getCompilerOptions();

                let inDir : string = 'src';
                if(typeof compilerSrcDirectory === 'string') {
                    inDir = compilerSrcDirectory.split(path.sep)[0];
                }

                const outDir : string = tsCompilerOptions.outDir ?? 'dist';

                if(Array.isArray(connectionOptions[key])) {
                    for(let i=0; i<connectionOptions[key].length; i++) {
                        const value = connectionOptions[key][i];
                        if(typeof value !== 'string') {
                            continue;
                        }

                        connectionOptions[key][i] = value
                            .replace(inDir, outDir)
                            .replace('.ts', '.js');
                    }
                } else {
                    if(typeof connectionOptions[key] === 'string') {
                        Object.assign(connectionOptions, {
                            [key]: (connectionOptions[key] as unknown as string)
                                .replace(inDir, outDir)
                                .replace('.ts', '.js')
                        });
                    }
                }
            }
            break;
    }

    return connectionOptions;
}
