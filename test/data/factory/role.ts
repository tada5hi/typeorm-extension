import { fakerDE as faker } from '@faker-js/faker';
import { setSeederFactory } from '../../../src';
import { Role } from '../entity/role';

export default setSeederFactory(Role, async () => {
    const role = new Role();
    role.name = faker.person.firstName('female');

    return role;
});
