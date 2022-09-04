import {setSeederFactory} from "../../../src";
import {User} from "../entity/user";

export default setSeederFactory(User, async (faker) => {
    const user = new User();
    user.firstName = faker.name.firstName('male');
    user.lastName = faker.name.lastName('male');
    user.email = faker.internet.email(user.firstName, user.lastName);

    return user;
})
