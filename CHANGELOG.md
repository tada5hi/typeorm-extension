# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.0.0] - 2021-10-24

### Added
- integrated `@trapi/query` library for query utils.

### Changed
- Database: renamed type `CustomOptions` to `DatabaseOperationOptions`.
- Database: renamed type `AdditionalConnectionOptions` to `ConnectionAdditionalOptions`.
- Query: argument option key `includes` renamed to `relations`.
- Query: argument option key `queryAlias` renamed to `defaultAlias`.
- Query: renamed function `applyIncludes` to `applyRelations`.

### Removed
- Query: Removed argument option key `stringCase`.
- Query: Removed deprecated function `applyRequestFields`

## [0.3.0] - 2021-09-26

[unreleased]: https://github.com/Tada5hi/typeorm-extension/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Tada5hi/typeorm-extension/compare/v0.3.0...v1.0.0
[0.3.0]: https://github.com/Tada5hi/typeorm-extension/releases/tag/v0.3.0
