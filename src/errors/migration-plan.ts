import { TypeormExtensionError } from './base';

function withHint(message: string, hint?: string): string {
    return hint ? `${message} ${hint}` : message;
}

export class MigrationPlanError extends TypeormExtensionError {
    readonly names: string[];

    constructor(message: string, names: string[] = [], options?: { cause?: unknown }) {
        super(message, options);
        this.names = names;
    }

    static duplicateNames(names: string[]) {
        return new MigrationPlanError(
            `The migration names are not unique: ${names.join(', ')}.`,
            names,
        );
    }

    static multipleBaselines(names: string[]) {
        return new MigrationPlanError(
            `Only one baseline migration is allowed, found: ${names.join(', ')}.`,
            names,
        );
    }

    static baselineMalformed(name: string) {
        return new MigrationPlanError(
            `The migration ${name} declares baseline properties but is not a baseline, extend MigrationBaseline.`,
            [name],
        );
    }

    static baselineNotInList(name: string) {
        return new MigrationPlanError(
            `The baseline migration ${name} is not part of the migrations list.`,
            [name],
        );
    }

    static legacyInList(names: string[]) {
        return new MigrationPlanError(
            `The legacy migrations must not be part of the migrations list: ${names.join(', ')}.`,
            names,
        );
    }

    static legacyEmpty(name: string) {
        return new MigrationPlanError(
            `The baseline migration ${name} declares legacy migrations, but none were resolved.`,
            [name],
        );
    }

    static legacyNotOlder(names: string[]) {
        return new MigrationPlanError(
            `The legacy migrations must be older than the baseline migration: ${names.join(', ')}.`,
            names,
        );
    }

    static currentOlderThanBaseline(names: string[]) {
        return new MigrationPlanError(
            `The migrations must not be older than the baseline migration: ${names.join(', ')}.`,
            names,
        );
    }

    static populatedSchemaWithoutHistory(tables: string[], hint?: string) {
        return new MigrationPlanError(
            withHint(
                `The schema holds tables but no migration history: ${tables.join(', ')}.`,
                hint,
            ),
            tables,
        );
    }

    static unknownExecuted(names: string[], hint?: string) {
        return new MigrationPlanError(
            withHint(
                `The database has executed migrations which are unknown to the migrations list: ${names.join(', ')}.`,
                hint,
            ),
            names,
        );
    }

    static legacyMissing(name: string, hint?: string) {
        return new MigrationPlanError(
            withHint(
                `The legacy migrations of the baseline migration ${name} have not all been executed.`,
                hint,
            ),
            [name],
        );
    }

    static baselineIrreversible(name: string) {
        return new MigrationPlanError(
            `The baseline migration ${name} can not be reverted.`,
            [name],
        );
    }

    static dataSourceInitializeRuns(flags: string[]) {
        return new MigrationPlanError(
            `The data source is not initialized and would run ${flags.join(', ')} on initialize, ` +
            'which bypasses the migration runner. Initialize it first or unset the options.',
            flags,
        );
    }

    static driverNotSupported(type: string) {
        return new MigrationPlanError(
            `The migration runner does not support the ${type} driver.`,
            [type],
        );
    }
}
