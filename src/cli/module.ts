import { defineCommand } from 'citty';
import {
    defineCLIDatabaseCommand,
    defineCLIDatabaseCreateCommand,
    defineCLIDatabaseDropCommand,
    defineCLISeedCommand,
    defineCLISeedCreateCommand,
    defineCLISeedRunCommand,
} from './commands';

export function createCLIEntryPointCommand() {
    return defineCommand({
        meta: {
            name: 'typeorm-extension',
            description: 'CLI for typeorm-extension.',
        },
        subCommands: {
            db: defineCLIDatabaseCommand(),
            seed: defineCLISeedCommand(),
            // Legacy colon-form aliases (kept for backwards compatibility with v3 invocations).
            'db:create': defineCLIDatabaseCreateCommand(),
            'db:drop': defineCLIDatabaseDropCommand(),
            'seed:create': defineCLISeedCreateCommand(),
            'seed:run': defineCLISeedRunCommand(),
        },
    });
}
