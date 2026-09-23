import process from 'node:process';
import { DataSource } from 'typeorm';
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
} from 'vitest';
import { withDataSourceTimezone } from '../../../../../src';
import { Stamp } from '../../../../data/entity/stamp';

/**
 * better-sqlite3 needs no pinning: `datetime('now')` stamps UTC, and typeorm
 * writes and reads the column as UTC. This holds that claim (made by the
 * withDataSourceTimezone docs) against a process far from UTC.
 */
describe('src/data-source/options/timezone (better-sqlite3)', () => {
    const previousTZ = process.env.TZ;

    beforeAll(() => {
        process.env.TZ = 'Pacific/Honolulu';
    });

    afterAll(() => {
        if (typeof previousTZ === 'undefined') {
            delete process.env.TZ;
        } else {
            process.env.TZ = previousTZ;
        }
    });

    it('should stamp and read the true instant without any pin', async () => {
        expect(new Date().getTimezoneOffset()).toEqual(600);

        const options = {
            type: 'better-sqlite3' as const, 
            database: ':memory:', 
            entities: [Stamp], 
            synchronize: true, 
        };
        expect(withDataSourceTimezone(options, 'UTC')).toBe(options);

        const dataSource = new DataSource(options);
        await dataSource.initialize();

        try {
            const repository = dataSource.getRepository(Stamp);
            const before = Date.now();
            const written = new Date(before);
            const saved = await repository.save(repository.create({ writtenAt: written }));
            const read = await repository.findOneByOrFail({ id: saved.id });

            // stamped by the database, which stores seconds only
            expect(Math.abs(read.createdAt.getTime() - before)).toBeLessThan(2_000);

            // written by the application, stored as a UTC wall clock
            expect(read.writtenAt.getTime()).toEqual(written.getTime());
            const [row] = await dataSource.query('SELECT "writtenAt" AS w FROM "stamp" WHERE "id" = ?', [saved.id]);
            expect(Date.parse(`${String(row.w).replace(' ', 'T')}Z`)).toEqual(written.getTime());
        } finally {
            await dataSource.destroy();
        }
    });
});
