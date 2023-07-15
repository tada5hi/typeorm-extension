import { hasOwnProperty, isObject } from 'locter';
import { setSeederFactory } from '../../../src';
import { User } from '../entity/user';

function isMeta(input: unknown) : input is { foo: string, [key: string]: any } {
    return isObject(input) &&
        hasOwnProperty(input, 'foo') &&
        typeof input.foo === 'string';
}

export default setSeederFactory(User, async (faker, meta) => {
    const user = new User();
    user.firstName = faker.person.firstName('male');
    user.lastName = faker.person.lastName('male');
    user.email = faker.internet.email({ firstName: user.firstName, lastName: user.lastName });
    user.foo = faker.lorem.word();
    user.phoneNumber = faker.phone.number();

    if (isMeta(meta)) {
        user.foo = meta.foo;
    }

    return user;
});
