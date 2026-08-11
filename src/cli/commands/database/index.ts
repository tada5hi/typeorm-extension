import { defineCommand } from 'citty';
import { defineCLIDatabaseCreateCommand } from './create';
import { defineCLIDatabaseDriftCommand } from './drift';
import { defineCLIDatabaseDropCommand } from './drop';

export * from './create';
export * from './drift';
export * from './drop';

export function defineCLIDatabaseCommand() {
    return defineCommand({
        meta: {
            name: 'db',
            description: 'Database operations.',
        },
        subCommands: {
            create: defineCLIDatabaseCreateCommand(),
            drift: defineCLIDatabaseDriftCommand(),
            drop: defineCLIDatabaseDropCommand(),
        },
    });
}
