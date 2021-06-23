import {Seeder} from "../../../src";
import {Connection} from "typeorm";

export default class DummySeed implements Seeder {
    run(connection: Connection): Promise<void> {
        return Promise.resolve();
    }
}
