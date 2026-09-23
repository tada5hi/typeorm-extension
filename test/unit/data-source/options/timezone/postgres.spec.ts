/* eslint-disable max-classes-per-file */
import { PlatformTools } from 'typeorm/platform/PlatformTools';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';
import { OptionsError } from '../../../../../src';
import {
    applyPostgresTimezone,
    createPostgresUTCClient,
    createPostgresUTCTypes,
    extractPostgresUrlOptions,
    parsePostgresArray,
    reserializePostgresLocalDateAsUTC,
    serializePostgresDateAsUTC,
} from '../../../../../src/data-source/options/timezone/postgres';

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

    describe('timestamp arrays', () => {
        it('should read a zone-less timestamp array as UTC', () => {
            const parse = createPostgresUTCTypes(pg.types).getTypeParser(1115, 'text');

            expect(parse('{"2026-09-22 19:05:49.85","2026-09-23 01:00:00",NULL}')).toEqual([
                new Date('2026-09-22T19:05:49.850Z'),
                new Date('2026-09-23T01:00:00.000Z'),
                null,
            ]);
        });
    });

    describe('parsePostgresArray', () => {
        const identity = (value: string) => value;

        it('should read quoted, NULL and nested elements', () => {
            expect(parsePostgresArray('{a,"b,c","d\\"e",NULL,"NULL"}', identity)).toEqual(['a', 'b,c', 'd"e', null, 'NULL']);
            expect(parsePostgresArray('{{a,b},{c,d}}', identity)).toEqual([['a', 'b'], ['c', 'd']]);
            expect(parsePostgresArray('{}', identity)).toEqual([]);
        });

        it('should skip a dimension decoration', () => {
            expect(parsePostgresArray('[0:1]={a,b}', identity)).toEqual(['a', 'b']);
        });
    });

    describe('extractPostgresUrlOptions', () => {
        it('should take the options out and keep every other byte', () => {
            expect(extractPostgresUrlOptions('postgres://h/db?a=%2F&options=-c+x%3D1&b=2#f')).toEqual({
                url: 'postgres://h/db?a=%2F&b=2#f',
                options: '-c x=1',
            });
            expect(extractPostgresUrlOptions('postgres://h/db?options=-c%20x%3D1')).toEqual({ url: 'postgres://h/db', options: '-c x=1' });
            expect(extractPostgresUrlOptions('postgres://h/db?a=1')).toEqual({ url: 'postgres://h/db?a=1' });
        });

        it('should take the last of repeated options, as pg does', () => {
            expect(extractPostgresUrlOptions('postgres://h/db?options=-c+x%3D1&options=-c+x%3D2')).toEqual({
                url: 'postgres://h/db',
                options: '-c x=2',
            });
        });
    });

    describe('reserializePostgresLocalDateAsUTC', () => {
        it('should re-serialize pg\'s local form of a Date as UTC', () => {
            expect(reserializePostgresLocalDateAsUTC('2026-09-22T09:05:49.850-10:00')).toEqual('2026-09-22T19:05:49.850+00:00');
            expect(reserializePostgresLocalDateAsUTC('2026-09-22T21:05:49.850+02:00')).toEqual('2026-09-22T19:05:49.850+00:00');
            expect(reserializePostgresLocalDateAsUTC('0005-01-01T00:00:00.000+00:00 BC')).toEqual('0005-01-01T00:00:00.000+00:00 BC');
        });

        it('should leave every other value alone', () => {
            expect(reserializePostgresLocalDateAsUTC('2026-09-22')).toEqual('2026-09-22');
            expect(reserializePostgresLocalDateAsUTC('hello')).toEqual('hello');
            expect(reserializePostgresLocalDateAsUTC(5)).toEqual(5);
        });
    });

    describe('createPostgresUTCClient (streams and submittables)', () => {
        class Recorder {
            calls : unknown[][] = [];

            query(...args: unknown[]) {
                this.calls.push(args);
                return 'result';
            }
        }

        it('should re-serialize the prepared values of a cursor', () => {
            const client = new (createPostgresUTCClient(Recorder))();
            const stream = { submit: () => undefined, cursor: { values: ['2026-09-22T09:05:49.850-10:00', 'x', 1] } };

            client.query(stream);
            expect(stream.cursor.values).toEqual(['2026-09-22T19:05:49.850+00:00', 'x', 1]);
            expect(client.calls[0][0]).toBe(stream);
        });

        it('should not mutate a plain config object', () => {
            const client = new (createPostgresUTCClient(Recorder))();
            const date = new Date('2026-09-22T19:05:49.850Z');
            const config = { text: 'SELECT $1', values: [date] };

            client.query(config);
            expect(config.values[0]).toBe(date);
            expect(client.calls[0][0]).toEqual({ text: 'SELECT $1', values: ['2026-09-22T19:05:49.850+00:00'] });
        });
    });

    describe('applyPostgresTimezone', () => {
        let pgoptions : string | undefined;

        beforeEach(() => {
            pgoptions = process.env.PGOPTIONS;
            delete process.env.PGOPTIONS;
        });

        afterEach(() => {
            if (typeof pgoptions === 'undefined') {
                delete process.env.PGOPTIONS;
            } else {
                process.env.PGOPTIONS = pgoptions;
            }
        });

        const apply = (options: Record<string, any>) => applyPostgresTimezone({
            type: 'postgres', 
            driver: pg, 
            ...options, 
        }) as any;

        it('should pin session, reader and writer', () => {
            const options = apply({ extra: { max: 3, options: '-c statement_timeout=5000' } });

            expect(options.extra.max).toEqual(3);
            expect(options.extra.options).toEqual('-c statement_timeout=5000 -c TimeZone=UTC');
            expect(options.extra.types.getTypeParser(1114, 'text')('2026-01-01 00:00:00')).toEqual(new Date('2026-01-01T00:00:00.000Z'));
            expect(new options.extra.Client()).toBeInstanceOf(pg.Client);
        });

        it('should keep PGOPTIONS, which pg stops reading once extra.options is set', () => {
            process.env.PGOPTIONS = '-c search_path=app';

            expect(apply({}).extra.options).toEqual('-c search_path=app -c TimeZone=UTC');
        });

        it('should move the options of a connection url into extra.options, which then carries the pin', () => {
            const options = apply({
                url: 'postgres://u:p@host:5432/db?sslmode=require&options=-c%20search_path%3Dapp',
                extra: { options: '-c statement_timeout=5000' },
            });

            expect(options.url).toEqual('postgres://u:p@host:5432/db?sslmode=require');
            expect(options.extra.options).toEqual('-c search_path=app -c TimeZone=UTC');
            expect(apply({ url: 'postgres://u:p@host/db' }).url).toEqual('postgres://u:p@host/db');
        });

        it('should ignore PGOPTIONS once the url carries options, as pg does', () => {
            process.env.PGOPTIONS = '-c search_path=env';

            expect(apply({ url: 'postgres://h/db?options=-c+search_path%3Durl' }).extra.options)
                .toEqual('-c search_path=url -c TimeZone=UTC');
        });

        it('should let extra.connectionString replace the url', () => {
            const options = apply({
                url: 'postgres://h/db?options=-c+search_path%3Durl',
                extra: { connectionString: 'postgres://other/db?options=-c+search_path%3Dextra#frag' },
            });

            expect(options.extra.connectionString).toEqual('postgres://other/db#frag');
            expect(options.extra.options).toEqual('-c search_path=extra -c TimeZone=UTC');
        });

        it('should refuse a replication node url carrying options', () => {
            expect(() => apply({
                replication: {
                    master: { url: 'postgres://u:p@master/db?options=-c+search_path%3Dapp' },
                    slaves: [{ host: 'slave' }],
                },
            })).toThrow(OptionsError);

            const options = apply({
                replication: {
                    master: { url: 'postgres://u:p@master/db?sslmode=require' },
                    slaves: [{ host: 'slave' }],
                },
            });
            expect(options.replication.master.url).toEqual('postgres://u:p@master/db?sslmode=require');
            expect(options.extra.options).toEqual('-c TimeZone=UTC');
        });

        it('should refuse a pin altered after it was applied, and keep an intact one', () => {
            const once = apply({});
            expect(applyPostgresTimezone(once)).toBe(once);

            expect(() => applyPostgresTimezone({ ...once, extra: { ...once.extra, options: '-c TimeZone=Europe/Berlin' } }))
                .toThrow(OptionsError);
            expect(() => applyPostgresTimezone({ ...once, extra: { ...once.extra, Client: pg.Client } }))
                .toThrow(OptionsError);
            expect(() => applyPostgresTimezone({ ...once, url: 'postgres://h/db?options=-c+search_path%3Dx' }))
                .toThrow(OptionsError);
        });

        it('should read the last TimeZone assignment, as postgres does', () => {
            expect(() => apply({ extra: { options: '-c TimeZone=UTC -c TimeZone=Europe/Berlin' } })).toThrow(OptionsError);
            expect(apply({ extra: { options: '-c TimeZone=Europe/Berlin -c TimeZone=UTC' } }).extra.options)
                .toEqual('-c TimeZone=Europe/Berlin -c TimeZone=UTC');
        });

        it('should match only a TimeZone assignment, and accept one naming UTC', () => {
            expect(apply({ extra: { options: '-c log_timezone=Europe/Berlin' } }).extra.options)
                .toEqual('-c log_timezone=Europe/Berlin -c TimeZone=UTC');

            for (const startup of [
                '-c TimeZone=UTC',
                '-ctimezone=Etc/UTC',
                '--timezone=utc',
                '-c TimeZone=GMT',
                '-c TimeZone=UCT',
                '-c TimeZone=Etc/GMT+0',
                '-c TimeZone=Greenwich',
                '-c TimeZone=\'UTC\'',
            ]) {
                expect(apply({ extra: { options: startup } }).extra.options).toEqual(startup);
            }
        });

        it('should refuse a foreign TimeZone wherever it comes from', () => {
            expect(() => apply({ extra: { options: '-c TimeZone=Europe/Berlin' } })).toThrow(OptionsError);
            expect(() => apply({ url: 'postgres://h/db?options=-c%20TimeZone%3DEurope%2FBerlin' })).toThrow(OptionsError);

            process.env.PGOPTIONS = '--timezone=America/New_York';
            expect(() => apply({})).toThrow(OptionsError);
        });

        it('should build on extra.types and extra.Client', () => {
            const parser = (value: string) => value;
            const types = { getTypeParser: (oid: number) => (oid === 23 ? parser : pg.types.getTypeParser(oid)) };
            class Client {}

            const options = apply({ extra: { types, Client } });
            expect(options.extra.types.getTypeParser(23, 'text')).toBe(parser);
            expect(options.extra.types.getTypeParser(1114, 'text')).not.toBe(pg.types.getTypeParser(1114));
            expect(new options.extra.Client()).toBeInstanceOf(Client);
        });

        it('should accept a timestamptz parser override, which the pin does not touch', () => {
            const parser = (value: string) => value;
            const types = { getTypeParser: (oid: number, format?: string) => (oid === 1184 ? parser : pg.types.getTypeParser(oid, format)) };

            const options = apply({ extra: { types } });
            expect(options.extra.types.getTypeParser(1184, 'text')).toBe(parser);
        });

        it('should refuse timestamp parsers overridden in extra.types or process-wide', () => {
            const types = { getTypeParser: (oid: number) => (oid === 1114 ? (value: string) => value : pg.types.getTypeParser(oid)) };
            expect(() => apply({ extra: { types } })).toThrow(OptionsError);

            const driver = { ...pg, types };
            expect(() => applyPostgresTimezone({ type: 'postgres', driver })).toThrow(OptionsError);
        });

        it('should subclass the pg-native client when typeorm would use it', () => {
            class Client {}
            class NativeClient {}
            const driver = {
                types: pg.types, 
                Client, 
                native: { Client: NativeClient }, 
            };

            const native = applyPostgresTimezone({
                type: 'postgres', 
                driver, 
                nativeDriver: {}, 
            }) as any;
            expect(new native.extra.Client()).toBeInstanceOf(NativeClient);

            const plain = applyPostgresTimezone({ type: 'postgres', driver: { ...driver, native: undefined } }) as any;
            expect(new plain.extra.Client()).toBeInstanceOf(Client);
        });
    });
});
