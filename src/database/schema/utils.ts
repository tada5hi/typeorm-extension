import type { DataSourceOptions } from 'typeorm';
import { DataSource, InstanceChecker } from 'typeorm';

export type OwnedDataSource = {
    dataSource: DataSource,
    /**
     * Whether the data source was built (and therefore must be destroyed) here.
     */
    owned: boolean
};

/**
 * Accept either an existing DataSource or the options to build one, and
 * guarantee it is initialized.
 *
 * A data source built here is owned by the caller of this function and must be
 * destroyed by it. A passed one is used as is — it is neither reconfigured
 * (the override only applies to a data source built here) nor destroyed.
 */
export async function useInitializedDataSource(
    input: DataSource | DataSourceOptions,
    override?: Partial<DataSourceOptions>,
) : Promise<OwnedDataSource> {
    if (InstanceChecker.isDataSource(input)) {
        if (!input.isInitialized) {
            await input.initialize();
        }

        return {
            dataSource: input,
            owned: false,
        };
    }

    const dataSource = new DataSource({
        ...input,
        ...(override || {}),
    } as DataSourceOptions);

    await dataSource.initialize();

    return {
        dataSource,
        owned: true,
    };
}
