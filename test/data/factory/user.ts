import {hasOwnProperty, isObject} from "locter";
import {setSeederFactory} from "../../../src";
import {User} from "../entity/user";

function isMeta(input: unknown) : input is { foo: string, [key: string]: any } {
    return isObject(input) &&
        hasOwnProperty(input, 'foo') &&
        typeof input.foo === 'string';
}

export default setSeederFactory(User, async (faker, meta) => {
    const user = new User();
    user.firstName = faker.name.firstName('male');
    user.lastName = faker.name.lastName('male');
    user.email = faker.internet.email(user.firstName, user.lastName);
    user.foo = faker.random.word();

    if(isMeta(meta)) {
        user.foo = meta.foo;
    }

    return user;
})
