import {setSeederFactory} from "../../../src";
import {User} from "../entity/user";

setSeederFactory(User, (faker) => {
    const user = new User();
    user.firstName = faker.name.firstName('male');
    user.lastName = faker.name.lastName('male');
    user.email = faker.internet.email(user.firstName, user.lastName);

    return user;
})
