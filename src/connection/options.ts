export type SimpleConnectionOptions = {
    database?: string,
    host?: string,
    user?: string,
    password?: string,
    port?: number,
    ssl?: any,
    // required for oracle and optional for other drivers
    url?: string
}

