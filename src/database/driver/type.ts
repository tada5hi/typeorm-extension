export type DriverOptions = {
    database?: string,
    host?: string,
    user?: string,
    password?: string,
    port?: number,
    ssl?: any,

    // required for oracle and optional for other drivers
    url?: string,
    connectString?: string,
    sid?: string | number,
    serviceName?: string,

    // add mssql support
    domain?: string,

    charset?: string,
    characterSet?: string,

    // postgres specific
    schema?: string,

    // only for postgres 13+, see https://www.postgresql.org/docs/current/manage-ag-templatedbs.html
    template?: string,

    extra?: {
        [key: string]: any
    }
};
