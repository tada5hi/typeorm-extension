# Factories with relations

You want factories to create entities that reference other entities: a parent row, child rows, or a many-to-many set.

The samples use a `Country` with many `State` rows and an `Internship` with many `Skill` rows:

```typescript
import { faker } from '@faker-js/faker';
import { setSeederFactory, useSeederFactory } from 'typeorm-extension';
import { Country, State } from './entities';

export const CountryFactory = setSeederFactory(Country, () => {
    const country = new Country();
    country.name = faker.location.country();
    return country;
});

export const StateFactory = setSeederFactory(State, (meta?: { country?: Country }) => {
    const state = new State();
    state.name = faker.location.state();
    state.country = meta?.country ?? (useSeederFactory(Country) as unknown as Country);
    return state;
});
```

## Many-to-one: one parent for many children

```typescript
const country = await factoryManager.get(Country).save();

await factoryManager.get<State, { country: Country }>(State)
    .setMeta({ country })
    .saveMany(10);
```

- You save the parent once and hand it to the factory with `setMeta()`. All ten states reference the same row.
- `saveMany(10, { country })` also sets the relation, but `params` apply after the factory ran. The nested
  `Country` factory in `StateFactory` has then already saved one unused country per state. Use `params` only when the
  factory has no nested factory for that property.
- Assigning the entity (or `{ id }`) is enough. TypeORM writes the foreign key column from it.

## Many-to-one: a new parent per child

```typescript
const states = await factoryManager.get(State).saveMany(3);
```

- Without meta, the property holds the `Country` factory. `save()` saves that factory first and assigns the saved
  country, so each state gets its own country.
- `make()` resolves the nested factory with `make()` as well and writes nothing.

## One-to-many: children for each parent

```typescript
const countries = await factoryManager.get(Country).saveMany(3);

for (const country of countries) {
    await factoryManager.get<State, { country: Country }>(State)
        .setMeta({ country })
        .saveMany(5);
}
```

- The foreign key lives on the child row, so you create the children per parent. If you pass one array of saved
  children to several parents (`saveMany(3, { states })`), each save moves the children again and only one parent
  keeps them.
- Await each iteration (`for...of`, not `forEach(async ...)`), otherwise the seeder returns before the rows exist.

## Many-to-many: assign a set

```typescript
const skills = await factoryManager.get(Skill).saveMany(5);

await factoryManager.get(Internship).save({ skills: skills.slice(0, 2) });
await factoryManager.get(Internship).save({ skills: skills.slice(2) });
```

- Save the related rows first, then assign an array on the side with `@JoinTable()`. Saving that side writes the
  join table rows.
- Several entities can share the same related rows, unlike one-to-many.
- `saveMany` saves concurrently, so a unique column such as `Skill.title` needs values that cannot collide.

## A shared parent seeded once

When several seeders need the same parent rows, let one seeder create them and run the others after it:

```typescript
import type { DataSource } from 'typeorm';
import type { Seeder } from 'typeorm-extension';
import { runSeeder } from 'typeorm-extension';
import CountrySeeder from './country.seeder';
import StateSeeder from './state.seeder';
import CitySeeder from './city.seeder';

export default class MainSeeder implements Seeder {
    async run(dataSource: DataSource): Promise<void> {
        await runSeeder(dataSource, CountrySeeder);
        await runSeeder(dataSource, StateSeeder);
        await runSeeder(dataSource, CitySeeder);
    }
}
```

- Configure only `seeds: [MainSeeder]`. A glob that also matches the other files runs them a second time.
- The later seeders read the parent rows back, for example with
  `dataSource.getRepository(Country).findOneByOrFail({ name: 'Germany' })`.
- Instead of a main seeder you can rely on the [order](../seeding#order-and-selecting-one-seeder): file names sort
  the glob results, and `track = true` on the parent seeder keeps it from running twice.

## See also

- [Factories](../seeding#factories), [`setSeederFactory`](../seeding-api-reference#setseederfactory),
  [`runSeeder`](../seeding-api-reference#runseeder)
- [Testing with better-sqlite3](./testing)
