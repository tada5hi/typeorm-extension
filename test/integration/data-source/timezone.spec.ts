import process from 'node:process';
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
} from 'vitest';
import { pinTimezone } from '../../../src';
import { Stamp } from '../../data/entity/stamp';
import {
    createIntegrationDataSourceOptions,
    supportsDataSourceTimezone,
    useIntegrationDriver,
} from '../../data/typeorm/integration';

const driver = useIntegrationDriver();

const HOUR = 3_600_000;
const MINUTE = 60_000;

type Measurement = {
    /**
     * The instant the process took right before writing.
     */
    before: number,
    /**
     * `createdAt`, stamped by the database, as read back.
     */
    createdAt: number,
    /**
     * `createdAt` as the database stores it, taken as UTC wall clock.
     */
    createdAtStored: number,
    /**
     * `writtenAt`, written by the application, and as read back.
     */
    written: number,
    writtenAt: number,
    /**
     * `writtenAt` as the database stores it, taken as UTC wall clock.
     */
    writtenAtStored: number,
};

/**
 * Read a column back as the wall clock the database holds, bypassing the
 * driver's own date handling.
 */
async function readWallClock(dataSource: DataSource, column: string, id: number) : Promise<number> {
    let rows : Record<string, string>[];

    switch (driver) {
        case 'postgres':
            rows = await dataSource.query(`SELECT to_char("${column}", 'YYYY-MM-DD"T"HH24:MI:SS') AS "w" FROM "stamp" WHERE "id" = $1`, [id]);
            break;
        case 'oracle':
            rows = await dataSource.query(`SELECT TO_CHAR("${column}", 'YYYY-MM-DD"T"HH24:MI:SS') AS "w" FROM "stamp" WHERE "id" = :1`, [id]);
            break;
        default:
            rows = await dataSource.query(`SELECT DATE_FORMAT(\`${column}\`, '%Y-%m-%dT%H:%i:%s') AS w FROM \`stamp\` WHERE \`id\` = ?`, [id]);
    }

    return Date.parse(`${rows[0].w}Z`);
}

/**
 * The database stamps zone-less columns in its SESSION zone, and the driver
 * writes and reads them in the zone of the Node PROCESS. The process runs at
 * -10 here; the postgres / mysql / mariadb session defaults to the database
 * zone, which is set to +14 (+13 where offsets stop below +14), while
 * node-oracledb takes the session zone from the process. Every check opens a
 * data source of its own, since a default applies to new sessions only.
 *
 * The control proves the environment really is off UTC by the stored wall
 * clock rather than by what reads back: on oracle both sides follow the
 * process, so an unpinned read looks right while the stored value is not.
 */
describe.runIf(supportsDataSourceTimezone(driver))(
    `src/data-source/options/timezone (${driver})`,
    () => {
        const previousTZ = process.env.TZ;
        let admin : DataSource;
        let previousZone : string | undefined;

        const quoteIdentifier = (name: string) => `"${name.replace(/"/g, '""')}"`;
        const quoteLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;

        async function measure(options: DataSourceOptions) : Promise<Measurement> {
            const dataSource = new DataSource(options);
            await dataSource.initialize();

            try {
                const repository = dataSource.getRepository(Stamp);
                const before = Date.now();
                const written = new Date(before);
                written.setUTCMilliseconds(0);

                const saved = await repository.save(repository.create({ writtenAt: written }));
                const read = await repository.findOneByOrFail({ id: saved.id });

                return {
                    before,
                    createdAt: read.createdAt.getTime(),
                    createdAtStored: await readWallClock(dataSource, 'createdAt', saved.id),
                    written: written.getTime(),
                    writtenAt: read.writtenAt.getTime(),
                    writtenAtStored: await readWallClock(dataSource, 'writtenAt', saved.id),
                };
            } finally {
                await dataSource.destroy();
            }
        }

        beforeAll(async () => {
            const options = createIntegrationDataSourceOptions([Stamp]);
            admin = new DataSource(options);
            await admin.initialize();

            const queryRunner = admin.createQueryRunner();
            try {
                await queryRunner.dropTable('stamp', true, true, true);
            } finally {
                await queryRunner.release();
            }
            await admin.synchronize(false);

            if (driver === 'postgres') {
                // a database-level default this suite finds is put back afterwards
                const rows : { setting: string }[] = await admin.query(
                    'SELECT unnest(setconfig) AS setting FROM pg_db_role_setting ' +
                    'WHERE setrole = 0 AND setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())',
                );
                const found = rows.find((row) => /^timezone=/i.test(row.setting));
                previousZone = found ? found.setting.slice(found.setting.indexOf('=') + 1) : undefined;

                await admin.query(`ALTER DATABASE ${quoteIdentifier(String(options.database))} SET timezone TO 'Pacific/Kiritimati'`);
            } else if (driver === 'mysql' || driver === 'mariadb') {
                const [row] = await admin.query('SELECT @@GLOBAL.time_zone AS zone');
                previousZone = row.zone;
                await admin.query('SET GLOBAL time_zone = \'+13:00\'');
            }

            process.env.TZ = 'Pacific/Honolulu';
        });

        afterAll(async () => {
            if (typeof previousTZ === 'undefined') {
                delete process.env.TZ;
            } else {
                process.env.TZ = previousTZ;
            }

            if (!admin || !admin.isInitialized) {
                return;
            }

            // each step runs whatever the one before it did: a server left
            // at a foreign default zone would skew every later suite on it
            const { options } = admin;
            try {
                if (driver === 'postgres') {
                    const database = quoteIdentifier(String(options.database));
                    await admin.query(typeof previousZone === 'undefined' ?
                        `ALTER DATABASE ${database} RESET timezone` :
                        `ALTER DATABASE ${database} SET timezone TO ${quoteLiteral(previousZone)}`);
                } else if (driver === 'mysql' || driver === 'mariadb') {
                    await admin.query(`SET GLOBAL time_zone = ${quoteLiteral(previousZone ?? 'SYSTEM')}`);
                }
            } finally {
                try {
                    const queryRunner = admin.createQueryRunner();
                    try {
                        await queryRunner.dropTable('stamp', true, true, true);
                    } finally {
                        await queryRunner.release();
                    }
                } finally {
                    await admin.destroy();
                }
            }
        });

        it('should store a non-UTC wall clock without the pin (environment check)', async () => {
            expect(new Date().getTimezoneOffset()).toEqual(600);

            const measurement = await measure(createIntegrationDataSourceOptions([Stamp]));

            expect(Math.abs(measurement.createdAtStored - measurement.before)).toBeGreaterThan(HOUR);
        });

        it('should store UTC and read the true instant with the pin', async () => {
            const measurement = await measure(pinTimezone(
                createIntegrationDataSourceOptions([Stamp]),
                'UTC',
            ));

            // stamped by the database
            expect(Math.abs(measurement.createdAtStored - measurement.before)).toBeLessThan(MINUTE);
            expect(Math.abs(measurement.createdAt - measurement.before)).toBeLessThan(MINUTE);

            // written by the application
            expect(measurement.writtenAtStored).toEqual(measurement.written);
            expect(measurement.writtenAt).toEqual(measurement.written);
        });

        async function pinned() : Promise<DataSource> {
            const dataSource = new DataSource(pinTimezone(
                createIntegrationDataSourceOptions([Stamp]),
                'UTC',
            ));
            await dataSource.initialize();

            return dataSource;
        }

        it('should hand the saved entity its stamped values as UTC', async () => {
            const dataSource = await pinned();
            try {
                const repository = dataSource.getRepository(Stamp);
                const before = Date.now();
                const saved = await repository.save(repository.create({ writtenAt: new Date(before) }));

                // oracle returns these through RETURNING ... INTO out-binds
                expect(Math.abs(saved.createdAt.getTime() - before)).toBeLessThan(MINUTE);
            } finally {
                await dataSource.destroy();
            }
        });

        it('should keep a calendar date as it was written', async () => {
            const dataSource = await pinned();
            try {
                const repository = dataSource.getRepository(Stamp);
                const saved = await repository.save(repository.create({ day: '2024-01-02' }));
                const read = await repository.findOneByOrFail({ id: saved.id });

                expect(read.day).toEqual('2024-01-02');
            } finally {
                await dataSource.destroy();
            }
        });

        it.runIf(driver === 'postgres')('should read a timestamp array as UTC', async () => {
            const dataSource = await pinned();
            try {
                const before = Date.now();
                const [row] = await dataSource.query('SELECT ARRAY[LOCALTIMESTAMP, LOCALTIMESTAMP] AS "values"');

                expect(row.values).toHaveLength(2);
                expect(Math.abs(row.values[0].getTime() - before)).toBeLessThan(MINUTE);
            } finally {
                await dataSource.destroy();
            }
        });

        it.runIf(driver === 'postgres')('should send the Date parameters of a stream as UTC', async () => {
            const dataSource = await pinned();
            try {
                const repository = dataSource.getRepository(Stamp);
                const written = new Date();
                written.setUTCMilliseconds(0);
                const saved = await repository.save(repository.create({ writtenAt: written }));

                const stream = await repository.createQueryBuilder('stamp')
                    .where('stamp.id = :id', { id: saved.id })
                    .andWhere('stamp.writtenAt = :written', { written })
                    .stream();

                const rows : Record<string, any>[] = await new Promise((resolve, reject) => {
                    const collected : Record<string, any>[] = [];
                    stream.on('data', (row: Record<string, any>) => collected.push(row));
                    stream.on('end', () => resolve(collected));
                    stream.on('error', reject);
                });

                expect(rows).toHaveLength(1);
                expect(new Date(rows[0].stamp_writtenAt).getTime()).toEqual(written.getTime());
            } finally {
                await dataSource.destroy();
            }
        });

        it.runIf(driver === 'postgres')('should pin a url carrying options, and keep PGOPTIONS', async () => {
            const options = createIntegrationDataSourceOptions([Stamp]) as Record<string, any>;
            const url = `postgres://${encodeURIComponent(options.username)}:${encodeURIComponent(options.password)}@${options.host}:${options.port}/${options.database}` +
                '?options=-c%20search_path%3Dpublic';

            const fromUrl = new DataSource(pinTimezone({
                type: 'postgres', 
                url, 
                entities: [Stamp], 
            }, 'UTC'));
            await fromUrl.initialize();
            try {
                const [zone] = await fromUrl.query('SHOW timezone');
                const [path] = await fromUrl.query('SHOW search_path');
                expect(zone.TimeZone).toEqual('UTC');
                expect(path.search_path).toEqual('public');
            } finally {
                await fromUrl.destroy();
            }

            const previous = process.env.PGOPTIONS;
            process.env.PGOPTIONS = '-c statement_timeout=12345';
            try {
                const fromEnv = await pinned();
                try {
                    const [zone] = await fromEnv.query('SHOW timezone');
                    const [timeout] = await fromEnv.query('SHOW statement_timeout');
                    expect(zone.TimeZone).toEqual('UTC');
                    expect(timeout.statement_timeout).toEqual('12345ms');
                } finally {
                    await fromEnv.destroy();
                }
            } finally {
                if (typeof previous === 'undefined') {
                    delete process.env.PGOPTIONS;
                } else {
                    process.env.PGOPTIONS = previous;
                }
            }
        });

        it.runIf(driver === 'oracle')('should bind executeMany rows as UTC', async () => {
            const dataSource = await pinned();
            try {
                const written = new Date();
                written.setUTCMilliseconds(0);

                const connection = await (dataSource.driver as any).master.getConnection();
                try {
                    await connection.executeMany(
                        'INSERT INTO "stamp" ("writtenAt") VALUES (:1)',
                        [[written], [written]],
                        { autoCommit: true },
                    );
                } finally {
                    await connection.close();
                }

                const rows = await dataSource.getRepository(Stamp).findBy({ writtenAt: written });
                expect(rows.length).toBeGreaterThanOrEqual(2);
                expect(await readWallClock(dataSource, 'writtenAt', rows[0].id)).toEqual(written.getTime());
            } finally {
                await dataSource.destroy();
            }
        });

        it.runIf(driver === 'oracle')('should compare a Date parameter without converting the column', async () => {
            const dataSource = await pinned();
            try {
                await dataSource.query('SELECT /* timezone-plan */ "id" FROM "stamp" WHERE "writtenAt" > :1', [new Date(0)]);
                const plan : { l: string }[] = await dataSource.query(
                    'SELECT plan_table_output AS "l" FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(' +
                    '(SELECT sql_id FROM v$sql WHERE sql_text LIKE \'SELECT /* timezone-plan */%\' AND ROWNUM = 1), NULL, \'BASIC +PREDICATE\'))',
                );
                const predicates = plan.map((row) => row.l).filter((line) => /access\(|filter\(/.test(line)).join('\n');

                expect(predicates).toContain('"writtenAt"');
                expect(predicates).not.toMatch(/INTERNAL_FUNCTION|SYS_EXTRACT_UTC/);
            } finally {
                await dataSource.destroy();
            }
        });
    },
);
