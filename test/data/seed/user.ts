import { Seeder, SeederFactoryManager } from '../../../src';
import { DataSource } from 'typeorm';
import { User } from '../entity/user';

export default class UserSeeder implements Seeder {
    public async run(
        dataSource: DataSource,
        factoryManager?: SeederFactoryManager
    ) : Promise<void> {
        const repository =  dataSource.getRepository(User);
        await repository.insert([
            {firstName: 'Caleb', lastName: 'Barrows', email: 'caleb.barrows@gmail.com'}
        ]);

        // ---------------------------------------------------

        const userFactory = await factoryManager.get(User);
        // save 1 factory generated entity, to the database
        await userFactory.save();

        // save 5 factory generated entities, to the database
        await userFactory.saveMany(5);
    }
}
