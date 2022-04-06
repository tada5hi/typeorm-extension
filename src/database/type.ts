import { DataSourceOptions } from 'typeorm';
import { DatabaseOperation } from './constants';

export type DatabaseCreateOperationContext = {
    options?: DataSourceOptions,
    ifNotExist?: boolean,
    initialDatabase?: string
};

export type DatabaseDeleteOperationContext = {
    options?: DataSourceOptions,
    ifExist?: boolean
};

export type DatabaseOperationContext<T extends `${DatabaseOperation}`> =
    T extends `${DatabaseOperation.CREATE}` ?
        DatabaseCreateOperationContext :
        DatabaseDeleteOperationContext;
