import type { DataSourceOptions } from 'typeorm';
import { DataSource, InstanceChecker } from 'typeorm';

export type OwnedDataSource = {
    dataSource: DataSource,
    /**
     * Whether the data source was built (and therefore must be destroyed) here.
     */
    owned: boolean
};

async function buildOwnedDataSource(
    options: DataSourceOptions,
    override?: Partial<DataSourceOptions>,
) : Promise<OwnedDataSource> {
    const dataSource = new DataSource({
        ...options,
        ...(override || {}),
    } as DataSourceOptions);

    await dataSource.initialize();

    return {
        dataSource,
        owned: true,
    };
}

/**
 * Whether initializing a data source with these options would do something the
 * override exists to prevent (e.g. synchronize or drop the schema).
 */
function conflictsWithOverride(
    options: DataSourceOptions,
    override: Partial<DataSourceOptions>,
) : boolean {
    const record = options as Record<string, any>;

    return Object.entries(override).some(
        ([key, value]) => !!record[key] && record[key] !== value,
    );
}

/**
 * Accept either an existing DataSource or the options to build one, and
 * guarantee it is initialized.
 *
 * A data source built here is owned by the caller of this function and must be
 * destroyed by it. An already initialized one is used as is and never
 * destroyed.
 *
 * An uninitialized DataSource is only initialized when doing so does not
 * conflict with the override: `DataSource.initialize()` applies the instance's
 * own `dropSchema` / `synchronize` / `migrationsRun`, and a read-only caller
 * passing the override exists precisely to prevent that. Such an instance is
 * therefore left untouched and inspected through an own one instead.
 */
export async function useInitializedDataSource(
    input: DataSource | DataSourceOptions,
    override?: Partial<DataSourceOptions>,
) : Promise<OwnedDataSource> {
    if (InstanceChecker.isDataSource(input)) {
        if (input.isInitialized) {
            return {
                dataSource: input,
                owned: false,
            };
        }

        if (override && conflictsWithOverride(input.options, override)) {
            return buildOwnedDataSource(input.options, override);
        }

        await input.initialize();

        return {
            dataSource: input,
            owned: false,
        };
    }

    return buildOwnedDataSource(input, override);
}
