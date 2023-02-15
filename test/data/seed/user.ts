import { Seeder, SeederFactoryManager } from '../../../src';
import { DataSource } from 'typeorm';
import { User } from '../entity/user';

export default class UserSeeder implements Seeder {
    public async run(
        dataSource: DataSource,
        factoryManager: SeederFactoryManager
    ) : Promise<unknown> {
        const repository =  dataSource.getRepository(User);

        await repository.insert([
            {firstName: 'Caleb', lastName: 'Barrows', email: 'caleb.barrows@gmail.com', foo: 'bar'}
        ]);

        // ---------------------------------------------------

        const items : User[] = [];

        const userFactory = await factoryManager.get(User);
        userFactory.setMeta({ foo: 'bar' });

        // save 1 factory generated entity, to the database
        items.push(await userFactory.save());

        // save 5 factory generated entities, to the database
        items.push(...await userFactory.saveMany(5));

        return items;
    }
}
