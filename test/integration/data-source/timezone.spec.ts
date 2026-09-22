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
import { withDataSourceTimezone } from '../../../src';
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

            const { options } = admin;
            if (driver === 'postgres') {
                const database = quoteIdentifier(String(options.database));
                await admin.query(typeof previousZone === 'undefined' ?
                    `ALTER DATABASE ${database} RESET timezone` :
                    `ALTER DATABASE ${database} SET timezone TO ${quoteLiteral(previousZone)}`);
            } else if (driver === 'mysql' || driver === 'mariadb') {
                await admin.query(`SET GLOBAL time_zone = ${quoteLiteral(previousZone ?? 'SYSTEM')}`);
            }

            const queryRunner = admin.createQueryRunner();
            try {
                await queryRunner.dropTable('stamp', true, true, true);
            } finally {
                await queryRunner.release();
            }

            await admin.destroy();
        });

        it('should store a non-UTC wall clock without the pin (environment check)', async () => {
            expect(new Date().getTimezoneOffset()).toEqual(600);

            const measurement = await measure(createIntegrationDataSourceOptions([Stamp]));

            expect(Math.abs(measurement.createdAtStored - measurement.before)).toBeGreaterThan(HOUR);
        });

        it('should store UTC and read the true instant with the pin', async () => {
            const measurement = await measure(withDataSourceTimezone(
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
    },
);
