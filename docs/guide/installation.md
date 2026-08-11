# Installation

Add the package as a dependency to the project.

```sh
npm install typeorm-extension typeorm --save
```

`typeorm` is a peer dependency and is required in the range `^1.1.0`.

Seeder factories generate their data with a library of your choice, so nothing extra is required by this
package. The documentation examples use [faker](https://fakerjs.dev/guide/):

```sh
npm install @faker-js/faker --save
```

Use `--save-dev` instead if seeders only ever run in development or CI. Factory files import the generator
at runtime, so an installation without development dependencies cannot execute them.
