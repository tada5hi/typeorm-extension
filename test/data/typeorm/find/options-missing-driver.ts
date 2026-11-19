import type { DataSourceOptions } from 'typeorm';

// the sap driver package (@sap/hana-client) is not installed:
// new DataSource(options) throws for these options.
export const options : DataSourceOptions = {
    type: 'sap',
    host: 'localhost',
    extra: { marker: 'missing-driver' },
} as DataSourceOptions;
