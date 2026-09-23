import { PlatformTools } from 'typeorm/platform/PlatformTools';
import { describe, expect, it } from 'vitest';
import {
    createPostgresUTCClient,
    createPostgresUTCTypes,
    serializePostgresDateAsUTC,
} from '../../../../../src';

const pg = PlatformTools.load('pg');

describe('src/data-source/options/timezone/postgres', () => {
    describe('createPostgresUTCTypes', () => {
        const types = createPostgresUTCTypes(pg.types);
        const parse = types.getTypeParser(1114, 'text');

        it('should read a zone-less timestamp as UTC', () => {
            expect(parse('2026-09-22 19:05:49.850123')).toEqual(new Date('2026-09-22T19:05:49.850Z'));
            expect(parse('2026-09-22 19:05:49')).toEqual(new Date('2026-09-22T19:05:49.000Z'));
        });

        it('should keep infinity and BC dates working', () => {
            expect(parse('infinity')).toEqual(Infinity);
            expect(parse('-infinity')).toEqual(-Infinity);

            const bc = parse('0005-01-01 00:00:00 BC') as Date;
            expect(bc.getUTCFullYear()).toEqual(-4);
            expect(bc.getUTCHours()).toEqual(0);
        });

        it('should delegate every other type and the binary format', () => {
            expect(types.getTypeParser(1184, 'text')).toBe(pg.types.getTypeParser(1184, 'text'));
            expect(types.getTypeParser(23, 'text')).toBe(pg.types.getTypeParser(23, 'text'));
            expect(types.getTypeParser(1114, 'binary')).toBe(pg.types.getTypeParser(1114, 'binary'));
        });
    });

    describe('serializePostgresDateAsUTC', () => {
        it('should serialize the UTC fields with an explicit offset', () => {
            expect(serializePostgresDateAsUTC(new Date('2026-09-22T21:05:49.850Z'))).toEqual('2026-09-22T21:05:49.850+00:00');
            expect(serializePostgresDateAsUTC(new Date('0005-01-01T00:00:00.000Z'))).toEqual('0005-01-01T00:00:00.000+00:00');
        });

        it('should mark years before 1 as BC', () => {
            const date = new Date('2026-01-01T00:00:00.000Z');
            date.setUTCFullYear(-4);

            expect(serializePostgresDateAsUTC(date)).toEqual('0005-01-01T00:00:00.000+00:00 BC');
        });
    });

    describe('createPostgresUTCClient', () => {
        class Recorder {
            calls : unknown[][] = [];

            query(...args: unknown[]) {
                this.calls.push(args);
                return 'result';
            }
        }

        const date = new Date('2026-09-22T21:05:49.850Z');
        const utc = '2026-09-22T21:05:49.850+00:00';

        it('should send Date values as UTC, nested arrays included', () => {
            const client = new (createPostgresUTCClient(Recorder))();
            const callback = () => undefined;

            expect(client.query('SELECT $1, $2, $3', [date, [date, 1], 'x'], callback)).toEqual('result');
            expect(client.calls[0]).toEqual(['SELECT $1, $2, $3', [utc, [utc, 1], 'x'], callback]);
        });

        it('should send the values of a config object as UTC', () => {
            const client = new (createPostgresUTCClient(Recorder))();
            const config = { text: 'SELECT $1', values: [date] };

            client.query(config);
            expect(client.calls[0][0]).toEqual({ text: 'SELECT $1', values: [utc] });
        });

        it('should pass a query without values through', () => {
            const client = new (createPostgresUTCClient(Recorder))();
            const callback = () => undefined;

            client.query('SELECT 1', callback);
            expect(client.calls[0]).toEqual(['SELECT 1', callback, undefined]);
        });
    });
});
