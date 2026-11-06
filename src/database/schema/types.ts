import type { DataSource } from 'typeorm';


export type OwnedDataSource = {
    dataSource: DataSource,
    /**
     * Whether the data source was built (and therefore must be destroyed) here.
     */
    owned: boolean
};
