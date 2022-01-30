export type DriverConnectionOptions = {
    database?: string,
    host?: string,
    user?: string,
    password?: string,
    port?: number,
    ssl?: any,
    // required for oracle and optional for other drivers
    url?: string,

    // for extra driver connection options
    [key: string]: any
};
