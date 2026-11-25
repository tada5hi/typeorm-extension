import type { QueryRunner } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { withSchemaSearchPath } from '../../../../../src/database/schema/snapshot/search-path';

/**
 * A query runner which answers the search path statements and records them.
 */
class SearchPathRunner {
    readonly statements: [string, unknown[] | undefined][] = [];

    failRestore = false;

    readonly connection: { options: Record<string, unknown> };

    constructor(options: Record<string, unknown>, protected currentSchema: string | null = 'public') {
        this.connection = { options };
    }

    async query(sql: string, parameters?: unknown[]) {
        this.statements.push([sql, parameters]);

        if (sql === 'SHOW search_path') {
            return [{ search_path: '"$user", public' }];
        }

        if (sql.startsWith('SELECT current_schema()')) {
            return [{ schema: this.currentSchema }];
        }

        if (this.failRestore && parameters?.[0] === '"$user", public') {
            throw new Error('restore failed');
        }

        return [];
    }

    asRunner() : QueryRunner {
        return this as unknown as QueryRunner;
    }
}

const PIN = 'SELECT set_config(\'search_path\', quote_ident($1), false)';
const RESTORE = 'SELECT set_config(\'search_path\', $1, false)';

describe('database/schema/snapshot/search-path', () => {
    it('leaves other drivers alone', async () => {
        const runner = new SearchPathRunner({ type: 'better-sqlite3' });

        expect(await withSchemaSearchPath(runner.asRunner(), async () => 'x')).toBe('x');
        expect(runner.statements).toEqual([]);
    });

    it('pins the configured schema and restores the previous path', async () => {
        const runner = new SearchPathRunner({ type: 'postgres', schema: 'app' });

        expect(await withSchemaSearchPath(runner.asRunner(), async () => 'x')).toBe('x');
        expect(runner.statements).toEqual([
            ['SHOW search_path', undefined],
            [PIN, ['app']],
            [RESTORE, ['"$user", public']],
        ]);
    });

    it('pins the current schema without a configured one', async () => {
        const runner = new SearchPathRunner({ type: 'cockroachdb' }, 'other');

        await withSchemaSearchPath(runner.asRunner(), async () => 'x');

        expect(runner.statements[2]).toEqual([PIN, ['other']]);
    });

    it('does not pin without a current schema', async () => {
        const runner = new SearchPathRunner({ type: 'postgres' }, null);

        await withSchemaSearchPath(runner.asRunner(), async () => 'x');

        expect(runner.statements.map(([sql]) => sql)).not.toContain(PIN);
    });

    it('restores after a failing read and keeps its error over a failing restore', async () => {
        const runner = new SearchPathRunner({ type: 'postgres', schema: 'app' });

        await expect(withSchemaSearchPath(runner.asRunner(), async () => {
            throw new Error('read failed');
        })).rejects.toThrow('read failed');
        expect(runner.statements[2]).toEqual([RESTORE, ['"$user", public']]);

        runner.failRestore = true;

        await expect(withSchemaSearchPath(runner.asRunner(), async () => {
            throw new Error('read failed');
        })).rejects.toThrow('read failed');
    });

    it('propagates a failing restore after a successful read', async () => {
        const runner = new SearchPathRunner({ type: 'postgres', schema: 'app' });

        runner.failRestore = true;

        await expect(withSchemaSearchPath(runner.asRunner(), async () => 'x')).rejects.toThrow('restore failed');
    });
});
