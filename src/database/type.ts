import {ConnectionOptions} from "typeorm";

export type CustomOptions = {
    ifNotExist?: boolean,
    ifExist?: boolean,
    charset?: string,
    characterSet?: string
};

export type AdditionalConnectionOptions = {
    // in case of mysql it is equal to collation
    charset?: string,
    characterSet?: string,
}

export type ConnectionWithAdditionalOptions = ConnectionOptions & AdditionalConnectionOptions;
