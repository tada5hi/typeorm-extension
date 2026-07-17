/* eslint-disable max-classes-per-file */
import type { Seeder } from '../../../src';
import { SeederEntity } from '../../../src';

class TrackedSeeder implements Seeder {
    track = true;

    public async run() : Promise<unknown> {
        return undefined;
    }
}

class UntrackedSeeder implements Seeder {
    track = false;

    public async run() : Promise<unknown> {
        return undefined;
    }
}

class DefaultSeeder implements Seeder {
    public async run() : Promise<unknown> {
        return undefined;
    }
}

function createEntity(ctx: {
    constructor?: new () => Seeder,
    timestamp?: number,
    fileName?: string
}) : SeederEntity {
    return new SeederEntity({
        timestamp: ctx.timestamp ?? 0,
        name: ctx.constructor ? ctx.constructor.name : 'Anonymous',
        constructor: ctx.constructor,
        fileName: ctx.fileName,
    });
}

describe('src/seeder/entity.ts', () => {
    describe('effectiveTracking', () => {
        it('should prefer the per-seed track property over the executor-level default', () => {
            expect(createEntity({ constructor: TrackedSeeder }).effectiveTracking(false)).toBe(true);
            expect(createEntity({ constructor: UntrackedSeeder }).effectiveTracking(true)).toBe(false);
        });

        it('should fall back to the executor-level default', () => {
            expect(createEntity({ constructor: DefaultSeeder }).effectiveTracking(true)).toBe(true);
            expect(createEntity({ constructor: DefaultSeeder }).effectiveTracking(false)).toBe(false);
        });

        it('should fall back to the executor-level default without an instance', () => {
            expect(createEntity({}).effectiveTracking(true)).toBe(true);
            expect(createEntity({}).effectiveTracking(false)).toBe(false);
        });
    });

    describe('compare', () => {
        it('should order by file name when both entities are file-backed', () => {
            const a = createEntity({ fileName: 'a-seed.ts', timestamp: 2 });
            const b = createEntity({ fileName: 'b-seed.ts', timestamp: 1 });

            expect(SeederEntity.compare(a, b)).toBeLessThan(0);
            expect(SeederEntity.compare(b, a)).toBeGreaterThan(0);
        });

        it('should fall back to timestamp for equal file names', () => {
            const a = createEntity({ fileName: 'seed.ts', timestamp: 1 });
            const b = createEntity({ fileName: 'seed.ts', timestamp: 2 });

            expect(SeederEntity.compare(a, b)).toBeLessThan(0);
            expect(SeederEntity.compare(b, a)).toBeGreaterThan(0);
            expect(SeederEntity.compare(a, a)).toEqual(0);
        });

        it('should order by timestamp when a file name is missing', () => {
            const a = createEntity({ timestamp: 1 });
            const b = createEntity({ fileName: 'b-seed.ts', timestamp: 2 });

            expect(SeederEntity.compare(a, b)).toBeLessThan(0);
            expect(SeederEntity.compare(b, a)).toBeGreaterThan(0);
            expect(SeederEntity.compare(a, a)).toEqual(0);
        });

        it('should sort a mixed list deterministically', () => {
            const entities = [
                createEntity({ fileName: 'b-seed.ts', timestamp: 0 }),
                createEntity({ fileName: 'a-seed.ts', timestamp: 3 }),
            ];

            const sorted = [...entities].sort(SeederEntity.compare);
            expect(sorted.map((entity) => entity.fileName)).toEqual([
                'a-seed.ts',
                'b-seed.ts',
            ]);
        });
    });
});
