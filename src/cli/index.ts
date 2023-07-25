#!/usr/bin/env node
import 'reflect-metadata';
import process from 'node:process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import {
    DatabaseCreateCommand,
    DatabaseDropCommand,
    SeedCreateCommand,
    SeedRunCommand,
} from './commands';

yargs(hideBin(process.argv))
    .scriptName('typeorm-extension')
    .usage('Usage: $0 <command> [options]')
    .demandCommand(1)
    .command(new DatabaseCreateCommand())
    .command(new DatabaseDropCommand())
    .command(new SeedRunCommand())
    .command(new SeedCreateCommand())
    .strict()
    .alias('v', 'version')
    .help('h')
    .alias('h', 'help')
    .parse();
