import { Seeder, SeederFactoryManager } from '../../../src';
import { DataSource } from 'typeorm';
import { User } from '../entity/user';

export default class UserSeeder implements Seeder {
    public async run(
        dataSource: DataSource,
        factoryManager?: SeederFactoryManager
    ) : Promise<any> {
        const repository =  dataSource.getRepository(User);
        await repository.insert([
            {firstName: 'Caleb', lastName: 'Barrows', email: 'caleb.barrows@gmail.com'}
        ]);

        // ---------------------------------------------------

        const users = [] as any[];
        const userFactory = await factoryManager.get(User);
        // save 1 factory generated entity, to the database
        const user1 = await userFactory.save();
        users.push(user1);

        // save 5 factory generated entities, to the database
        const users2 = await userFactory.saveMany(5);
        users.push(users2);

        return users;
    }
}
