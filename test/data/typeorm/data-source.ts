import {DataSource, DataSourceOptions} from "typeorm";
import path from "path";
import {User} from "../entity/user";
import {SeederOptions} from "../../../src";

const options : DataSourceOptions & SeederOptions = {
    type: 'better-sqlite3',
    entities: [User],
    database: path.join(__dirname, 'db.sqlite'),
    factories: [path.join(__dirname, '..', 'factory', 'user.ts')],
    seeds: [path.join(__dirname, '..', 'seed', 'user.ts')]
};

export const dataSource = new DataSource(options);
