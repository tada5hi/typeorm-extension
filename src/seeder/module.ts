import type { DataSource } from 'typeorm';
import type { SeederEntity } from './entity';
import { SeederExecutor } from './executor';
import type { SeederConstructor, SeederOptions } from './type';

export async function runSeeder(
    dataSource: DataSource,
    seeder: SeederConstructor | string,
    options: SeederOptions = {},
) : Promise<SeederEntity | undefined> {
    if (typeof seeder === 'string') {
        options.seedName = seeder;
    } else {
        options.seeds = [seeder];
    }

    const executor = new SeederExecutor(dataSource);
    const output = await executor.execute(options);

    return output.pop();
}

export async function runSeeders(
    dataSource: DataSource,
    options?: SeederOptions,
) : Promise<SeederEntity[]> {
    const executor = new SeederExecutor(dataSource);
    return executor.execute(options);
}
