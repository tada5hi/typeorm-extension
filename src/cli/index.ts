#!/usr/bin/env node
import 'reflect-metadata';
import { runMain } from 'citty';
import { createCLIEntryPointCommand } from './module';

runMain(createCLIEntryPointCommand());
