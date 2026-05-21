import { defineCommand } from 'citty';
import { defineCLIDatabaseCreateCommand } from './create';
import { defineCLIDatabaseDropCommand } from './drop';

export * from './create';
export * from './drop';

export function defineCLIDatabaseCommand() {
    return defineCommand({
        meta: {
            name: 'db',
            description: 'Database operations.',
        },
        subCommands: {
            create: defineCLIDatabaseCreateCommand(),
            drop: defineCLIDatabaseDropCommand(),
        },
    });
}
