import { defineCommand } from 'citty';
import { defineCLISeedCreateCommand } from './create';
import { defineCLISeedRunCommand } from './run';

export * from './create';
export * from './run';

export function defineCLISeedCommand() {
    return defineCommand({
        meta: {
            name: 'seed',
            description: 'Seeder operations.',
        },
        subCommands: {
            create: defineCLISeedCreateCommand(),
            run: defineCLISeedRunCommand(),
        },
    });
}
