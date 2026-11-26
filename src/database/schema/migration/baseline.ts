import type { MigrationInterface, QueryRunner } from 'typeorm';
import { MigrationPlanError } from '../../../errors';
import type { MigrationBaselineClass, MigrationsInput } from './types';

/**
 * @experimental The migration runner API may change in a minor release.
 */
export abstract class MigrationBaseline implements MigrationInterface {
    static readonly baseline = true;

    /**
     * @experimental May change in a minor release.
     */
    static legacy?: MigrationsInput;

    /**
     * @experimental May change in a minor release.
     */
    static upgradeHint?: string;

    abstract up(queryRunner: QueryRunner): Promise<void>;

    async down(): Promise<void> {
        throw MigrationPlanError.baselineIrreversible(this.constructor.name);
    }
}

/**
 * @experimental The migration runner API may change in a minor release.
 */
export function isMigrationBaselineClass(value: unknown): value is MigrationBaselineClass {
    return typeof value === 'function' &&
        (value as { baseline?: unknown }).baseline === true;
}
