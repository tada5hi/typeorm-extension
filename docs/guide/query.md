# Query
The query submodule enables query parameter (fields, filter, ...) values to be build, parsed & validated.
Therefore, the [rapiq](https://www.npmjs.com/package/rapiq) library is used under the hood.
The main functions and types are also exposed by this library.

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
Each query parameter is applied individually in following code snippet (applyQueryFields, applyQueryFilter, ...).

```typescript
import { getRepository } from 'typeorm';
import { Request, Response } from 'express';
import {
    applyQueryFields,
    applyQueryFilters,
    applyQueryRelations,
    applyQueryPagination,
    applyQuerySort
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
    const {fields, filter, include, page, sort} = req.query;

    const repository = getRepository(User);
    const query = repository.createQueryBuilder('user');

    // -----------------------------------------------------

    const relationsParsed = applyQueryRelations(query, include, {
        defaultAlias: 'user',
        allowed: ['profile']
    });

    applyQuerySort(query, sort, {
        defaultAlias: 'user',
        allowed: ['id', 'name', 'profile.id'],
        // profile.id can only be used as sorting key, if the relation 'profile' is included.
        relations: relationsParsed
    });

    applyQueryFields(query, fields, {
        defaultAlias: 'user',
        allowed: ['id', 'name', 'profile.id', 'profile.avatar'],
        // porfile fields can only be included, if the relation 'profile' is included.
        relations: relationsParsed
    })

    // only allow filtering users by id & name
    applyQueryFilters(query, filter, {
        defaultAlias: 'user',
        allowed: ['id', 'name', 'profile.id'],
        // porfile.id can only be used as a filter, if the relation 'profile' is included.
        relations: relationsParsed
    });

    // only allow to select 20 items at maximum.
    const pagination = applyQueryPagination(query, page, {maxLimit: 20});

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
