#!/usr/bin/env node
import 'reflect-metadata';
import yargs from 'yargs';

import {DatabaseSetupCommand} from './commands';

// tslint:disable-next-line:no-unused-expression
yargs
    .usage("Usage: $0 <command> [options]")
    .demandCommand(1)
    .command(new DatabaseSetupCommand())
    .strict()
    .alias("v", "version")
    .help("h")
    .alias("h", "help")
    .argv;

