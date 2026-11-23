import type { MigrationInterface, QueryRunner } from 'typeorm';
import { MigrationPlanError } from '../../../errors';
import type { MigrationBaselineClass, MigrationsInput } from './types';

export abstract class MigrationBaseline implements MigrationInterface {
    static readonly baseline = true;

    static legacy?: MigrationsInput;

    static upgradeHint?: string;

    abstract up(queryRunner: QueryRunner): Promise<void>;

    async down(): Promise<void> {
        throw MigrationPlanError.baselineIrreversible(this.constructor.name);
    }
}

export function isMigrationBaselineClass(value: unknown): value is MigrationBaselineClass {
    return typeof value === 'function' &&
        (value as { baseline?: unknown }).baseline === true;
}
