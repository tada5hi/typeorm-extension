import { ConnectionOptions } from 'typeorm';

export type DatabaseOperationOptions = {
    characterSet?: string,
    charset?: string,
    ifExist?: boolean,
    ifNotExist?: boolean,
    initialDatabase?: string
};

export type ConnectionAdditionalOptions = {
    // in case of mysql it is equal to collation
    charset?: string,
    characterSet?: string,
};

export type ConnectionWithAdditionalOptions = ConnectionOptions & ConnectionAdditionalOptions;
