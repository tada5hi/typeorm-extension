import type { DataSource } from 'typeorm';
import type { Seeder, SeederFactoryManager } from '../../../src';
import { Role } from '../entity/role';

export class RoleSeeder implements Seeder {
    track = true;

    public async run(
        dataSource: DataSource,
        _factoryManager: SeederFactoryManager,
    ) : Promise<unknown> {
        const repository = dataSource.getRepository(Role);

        await repository.insert([
            {
                name: 'admin',
            },
        ]);

        return undefined;
    }
}
