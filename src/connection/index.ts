import {ConnectionOptions, ConnectionOptionsReader} from "typeorm";
import path from 'path';
import {
    ConnectionWithSeederOptions,
    getCompilerOptions,
    hasOwnProperty,
    isTsNodeRuntimeEnvironment
} from "../index";
import {ConnectionBuilderOptions} from "./type";

export {
    SimpleConnectionOptions
} from "./options";
export * from './type';

export async function buildConnectionOptions(
    options?: ConnectionBuilderOptions
) :  Promise<ConnectionWithSeederOptions> {
    options = options ?? {};

    const connectionOptionsReader = new ConnectionOptionsReader({
        root: options.root ?? process.cwd(),
        configName: options.configName ?? 'ormconfig'
    });

    const connectionOptions : ConnectionWithSeederOptions = await connectionOptionsReader.get(options.name ?? 'default');

    if (options.buildForCommand) {
        Object.assign(connectionOptions, {
            subscribers: [],
            synchronize: false,
            migrationsRun: false,
            dropSchema: false,
            logging: ["query", "error", "schema"]
        } as ConnectionOptions);
    }

    if (!connectionOptions.factories) {
        connectionOptions.factories = [
            process.env.TYPEORM_SEEDING_FACTORIES ||
            'src/database/factories/**/*{.ts,.js}'
        ]
    }
    if (!connectionOptions.seeds) {
        connectionOptions.seeds = [
            process.env.TYPEORM_SEEDS ||
            process.env.TYPEORM_SEEDING_SEEDS ||
            'src/database/seeds/**/*{.ts,.js}'
        ]
    }

    modifyConnectionOptionsForRuntimeEnvironment(connectionOptions);

    return connectionOptions;
}

export function modifyConnectionOptionsForRuntimeEnvironment(
    connectionOptions: ConnectionWithSeederOptions,
) {
    const keys : Extract<keyof ConnectionWithSeederOptions, 'entities' | 'subscribers' | 'seeds' | 'factories'>[] = [
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

export function modifyConnectionOptionForRuntimeEnvironment<T extends Record<string, any>>(
    options: T,
    key: keyof ConnectionWithSeederOptions,
    compilerSrcDirectory?: string
) : T {
    if(!hasOwnProperty(options, key)) {
        return options;
    }

    let value = options[key];

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

                if(Array.isArray(value)) {
                    for(let i=0; i<value.length; i++) {
                        const str = value[i];
                        if(typeof str !== 'string') {
                            continue;
                        }

                        value[i] = str
                            .replace(inDir, outDir)
                            .replace('.ts', '.js');
                    }
                } else {
                    if(typeof value === 'string') {
                        value = value.replace(inDir, outDir)
                            .replace('.ts', '.js')
                    }
                }
            }
            break;
    }

    return {
        ...options,
        [key]: value
    };
}
