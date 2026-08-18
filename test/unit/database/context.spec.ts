import { describe, expect, it } from 'vitest';
import { buildDatabaseCreateContext, buildDatabaseDropContext } from '../../../src';

describe('src/database/utils/context', () => {
    it('should discover options when none are passed', async () => {
        const context = await buildDatabaseCreateContext({ findOptions: { directory: 'test/data/typeorm' } });

        expect(context.options).toBeDefined();
        expect(context.options.type).toEqual('better-sqlite3');
        expect(context.ifNotExist).toBeTruthy();
        expect(context.synchronize).toBeTruthy();

        // create/drop must never trigger side effects through the options
        expect(context.options.synchronize).toBeFalsy();
        expect(context.options.migrationsRun).toBeFalsy();
        expect(context.options.dropSchema).toBeFalsy();
    });

    it('should apply defaults for the drop context', async () => {
        const context = await buildDatabaseDropContext({ findOptions: { directory: 'test/data/typeorm' } });

        expect(context.options.type).toEqual('better-sqlite3');
        expect(context.ifExist).toBeTruthy();
    });
});
