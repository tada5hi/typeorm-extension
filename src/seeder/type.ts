import {Connection, ConnectionOptions} from "typeorm";

export interface Seeder {
    run(connection: Connection) : Promise<void>;
}

export type SeederConstructor = new () => Seeder;

export type SeederOptions = {
    seeds?: string[],
    factories?: string[]
};

export type ConnectionWithSeederOptions = ConnectionOptions & SeederOptions;
