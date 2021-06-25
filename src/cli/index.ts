#!/usr/bin/env node
import 'reflect-metadata';
import yargs from 'yargs';

import {
    DatabaseCreateCommand,
    DatabaseDropCommand
} from "./commands";

yargs
    .scriptName("typeorm-extension")
    .usage("Usage: $0 <command> [options]")
    .demandCommand(1)
    .command(new DatabaseCreateCommand())
    .command(new DatabaseDropCommand())
    .strict()
    .alias("v", "version")
    .help("h")
    .alias("h", "help")
    .argv;

