# What is it?

This is a library to:
- `create`, `drop` & `seed` the (default-) database 🔥
- manage one or many data-source instances 👻
- parse & apply query parameters (extended **JSON:API** specification & fully typed) to:
    - `filter` (related) resources according to one or more criteria,
    - reduce (related) resource `fields`,
    - `include` related resources,
    - `sort` resources according to one or more criteria,
    - limit the number of resources returned in a response by `page` limit & offset
  
::: warning **Important NOTE**

The guide is under construction ☂ at the moment. So please stay patient or contribute to it, till it covers all parts ⭐.
:::

## Limitations

At the moment, only the following typeorm drivers are supported
to `create` or `drop` a database:

* CockroachDB
* MSSQL
* MySQL
* Oracle
* Postgres
* SQLite
