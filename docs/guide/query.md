# Query
The query submodule enables query parameter (fields, filter, ...) values to be build, parsed & validated.
Therefore, the [rapiq](https://www.npmjs.com/package/rapiq) library is used under the hood.

The query parameter options (allowed, default, ...) are fully typed 🔥 and depend on the (nested-) properties of the target entity passed to
the typeorm query builder.

:::info Info
For more details, get in touch with the rapiq [documentation](https://rapiq.tada5hi.net/).
:::

For explanation proposes,
two simple entities with a relation between them are declared to demonstrate the usage of the query utils:

```typescript
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    JoinColumn
} from 'typeorm';

@Entity()
export class User {
    @PrimaryGeneratedColumn({unsigned: true})
    id: number;

    @Column({type: 'varchar', length: 30})
    @Index({unique: true})
    name: string;

    @Column({type: 'varchar', length: 255, default: null, nullable: true})
    email: string;

    @OneToOne(() => Profile)
    profile: Profile;
}

@Entity()
export class Profile {
    @PrimaryGeneratedColumn({unsigned: true})
    id: number;

    @Column({type: 'varchar', length: 255, default: null, nullable: true})
    avatar: string;

    @Column({type: 'varchar', length: 255, default: null, nullable: true})
    cover: string;

    @OneToOne(() => User)
    @JoinColumn()
    user: User;
}
```

In the following example [express](https://www.npmjs.com/package/express) is used to handle the HTTP request.

```typescript
import { Request, Response } from 'express';
import {
    applyQuery,
    useDataSource
} from 'typeorm-extension';

/**
 * Get many users.
 *
 * Request example
 * - url: /users?page[limit]=10&page[offset]=0&include=profile&filter[id]=1&fields[user]=id,name
 *
 * Return Example:
 * {
 *     data: [
 *         {id: 1, name: 'tada5hi', profile: {avatar: 'avatar.jpg', cover: 'cover.jpg'}}
 *      ],
 *     meta: {
 *        total: 1,
 *        limit: 20,
 *        offset: 0
 *    }
 * }
 * @param req
 * @param res
 */
export async function getUsers(req: Request, res: Response) {
    const dataSource = await useDataSource();
    const repository = dataSource.getRepository(User);
    const query = repository.createQueryBuilder('user');

    // -----------------------------------------------------

    const { pagination } = applyQuery(query, req.query, {
        defaultAlias: 'user',
        fields: {
            // porfile fields can only be included,
            // if the relation 'profile' is included.
            allowed: ['id', 'name', 'profile.id', 'profile.avatar'],
        },
        filters: {
            // porfile.id can only be used as a filter,
            // if the relation 'profile' is included.
            allowed: ['id', 'name', 'profile.id'],
        },
        pagination: {
            // only allow to select 20 items at maximum.
            maxLimit: 20
        },
        relations: {
            allowed: ['profile']
        },
        sort: {
            // profile.id can only be used as sorting key, 
            // if the relation 'profile' is included.
            allowed: ['id', 'name', 'profile.id']
        },
    });

    // -----------------------------------------------------

    const [entities, total] = await query.getManyAndCount();

    return res.json({
        data: {
            data: entities,
            meta: {
                total,
                ...pagination
            }
        }
    });
}
```
