import { setSeederFactory } from '../../../src';
import { User } from '../entity/user';

export default setSeederFactory(User, async (faker) => {
    const user = new User();
    user.firstName = faker.person.firstName('male');
    user.lastName = faker.person.lastName('male');
    user.email = faker.internet.email({ firstName: user.firstName, lastName: user.lastName });

    return user;
});
