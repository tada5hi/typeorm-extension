import type { QueryRunner } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { MigrationBaseline, MigrationPlanError, isMigrationBaselineClass } from '../../../../../src';

class Initial extends MigrationBaseline {
    async up(_queryRunner: QueryRunner): Promise<void> {
        // noop
    }
}

describe('src/database/schema/migration/baseline', () => {
    it('should detect a subclass of MigrationBaseline', () => {
        expect(isMigrationBaselineClass(Initial)).toBe(true);
    });

    it('should detect a plain class with static baseline = true', () => {
        const Plain = Object.assign(() => {}, { baseline: true });

        expect(isMigrationBaselineClass(Plain)).toBe(true);
    });

    it('should reject a class with baseline = \'true\'', () => {
        const Plain = Object.assign(() => {}, { baseline: 'true' });

        expect(isMigrationBaselineClass(Plain)).toBe(false);
        expect(isMigrationBaselineClass(undefined)).toBe(false);
        expect(isMigrationBaselineClass('x')).toBe(false);
    });

    it('should throw baselineIrreversible on down()', async () => {
        const instance = new Initial();

        await expect(instance.down()).rejects.toThrow(MigrationPlanError);
        await expect(instance.down()).rejects.toThrow(/Initial/);
    });

    it('should append the hint to unknownExecuted and keep the names', () => {
        const error = MigrationPlanError.unknownExecuted(['A1', 'B2'], 'Upgrade via v1 first.');

        expect(error.names).toEqual(['A1', 'B2']);
        expect(error.message).toContain('A1');
        expect(error.message).toContain('Upgrade via v1 first.');
    });
});
