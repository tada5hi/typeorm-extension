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

/**
 * The database stamps zone-less columns in its SESSION zone and the driver
 * reads them in the zone of the Node PROCESS. Both are set far from UTC and
 * from each other here (+13 or +14 / -10), so a value survives only when both
 * halves are pinned. A default zone applies to new sessions only, which is
 * why every check opens a data source of its own. The control, built
 * without the pin, proves the shift is real so the main check cannot pass
 * vacuously.
 */
describe.runIf(supportsDataSourceTimezone(driver))(
    `src/data-source/options/timezone (${driver})`,
    () => {
        const previousTZ = process.env.TZ;
        let admin : DataSource;
        let previousZone : string | undefined;

        const quoteIdentifier = (name: string) => `"${name.replace(/"/g, '""')}"`;
        const quoteLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;

        async function stamp(options: DataSourceOptions) : Promise<number> {
            const dataSource = new DataSource(options);
            await dataSource.initialize();

            try {
                const repository = dataSource.getRepository(Stamp);
                const saved = await repository.save(repository.create({}));
                const read = await repository.findOneByOrFail({ id: saved.id });

                return read.createdAt.getTime();
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
            } else {
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
            } else {
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

        it('should shift without the pin (environment check)', async () => {
            const before = Date.now();
            const stamped = await stamp(createIntegrationDataSourceOptions([Stamp]));

            expect(new Date().getTimezoneOffset()).toEqual(600);
            expect(Math.abs(stamped - before)).toBeGreaterThan(3_600_000);
        });

        it('should stamp and read the true instant with the pin', async () => {
            const before = Date.now();
            const stamped = await stamp(withDataSourceTimezone(
                createIntegrationDataSourceOptions([Stamp]),
                'UTC',
            ));

            expect(Math.abs(stamped - before)).toBeLessThan(60_000);
        });
    },
);
