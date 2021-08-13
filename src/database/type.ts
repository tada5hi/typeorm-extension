import {ConnectionOptions} from "typeorm";

export type CustomOptions = {
    characterSet?: string,
    charset?: string,
    ifExist?: boolean,
    ifNotExist?: boolean,
    initialDatabase?: string
};

export type AdditionalConnectionOptions = {
    // in case of mysql it is equal to collation
    charset?: string,
    characterSet?: string,
}

export type ConnectionWithAdditionalOptions = ConnectionOptions & AdditionalConnectionOptions;
