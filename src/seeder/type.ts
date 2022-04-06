import { DataSource } from 'typeorm';

export interface Seeder {
    run(connection: DataSource) : Promise<void>;
}

export type SeederConstructor = new () => Seeder;

export type SeederOptions = {
    seeds?: string[],
    factories?: string[]
};
