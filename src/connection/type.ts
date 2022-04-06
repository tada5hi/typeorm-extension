export type ConnectionBuilderOptions = {
    name?: string,
    configName?: string,
    root?: string,
    tsConfigDirectory?: string,
    buildForCommand?: boolean
};

export type DriverConnectionOptions = {
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

    extra?: {
        [key: string]: any
    }
};
