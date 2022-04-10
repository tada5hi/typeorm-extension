import { DataSourceOptions } from 'typeorm';

export type DatabaseCreateContext = {
    options?: DataSourceOptions,
    ifNotExist?: boolean,
    initialDatabase?: string
};

export type DatabaseDropContext = {
    options?: DataSourceOptions,
    ifExist?: boolean
};
