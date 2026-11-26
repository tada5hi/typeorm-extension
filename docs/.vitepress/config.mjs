import { defineConfig } from 'vitepress';

export default defineConfig({
    title: 'typeorm-extension',
    base: '/',
    head: [
        ['link', {
            rel: 'icon', 
            type: 'image/svg+xml', 
            href: '/logo.svg', 
        }],
    ],
    themeConfig: {
        logo: { src: '/logo.svg', alt: 'typeorm-extension' },
        teFooter: {
            tagline: 'Create, migrate, check, lock and seed TypeORM databases on every driver, from code or the CLI.',
            columns: [
                {
                    title: 'Guide',
                    links: [
                        { text: 'Data Source', link: '/guide/data-source' },
                        { text: 'CLI', link: '/guide/cli' },
                        { text: 'Database', link: '/guide/database' },
                        { text: 'Locks', link: '/guide/locks' },
                        { text: 'Seeding', link: '/guide/seeding' },
                        { text: 'Recipes', link: '/guide/recipes/deploy' },
                        { text: 'Troubleshooting', link: '/guide/troubleshooting' },
                    ],
                },
                {
                    title: 'API Reference',
                    links: [
                        { text: 'Database', link: '/guide/database-api-reference' },
                        { text: 'DataSource', link: '/guide/datasource-api-reference' },
                        { text: 'Entity', link: '/guide/entity-api-reference' },
                        { text: 'Seeding', link: '/guide/seeding-api-reference' },
                    ],
                },
                {
                    title: 'Project',
                    links: [
                        { text: 'GitHub', link: 'https://github.com/tada5hi/typeorm-extension' },
                        { text: 'npm', link: 'https://www.npmjs.com/package/typeorm-extension' },
                        { text: 'Changelog', link: 'https://github.com/tada5hi/typeorm-extension/blob/master/CHANGELOG.md' },
                        { text: 'rapiq (query successor)', link: 'https://rapiq.tada5hi.net' },
                    ],
                },
            ],
            note: 'Released under the MIT License.',
        },
        socialLinks: [
            { icon: 'github', link: 'https://github.com/tada5hi/typeorm-extension' },
        ],
        editLink: {
            pattern: 'https://github.com/tada5hi/typeorm-extension/edit/master/docs/:path',
            text: 'Edit this page on GitHub',
        },
        nav: [
            {
                text: 'Home',
                link: '/',
                activeMatch: '/',
            },
            {
                text: 'Guide',
                link: '/guide/',
                activeMatch: '/guide/',
            },
        ],
        sidebar: {
            '/guide/': [
                {
                    text: 'Introduction',
                    items: [
                        { text: 'What is it?', link: '/guide/' },
                        { text: 'Installation', link: '/guide/installation' },
                    ],
                },
                {
                    text: 'Guide',
                    items: [
                        { text: 'Data Source', link: '/guide/data-source' },
                        { text: 'CLI', link: '/guide/cli' },
                        { text: 'Database', link: '/guide/database' },
                        { text: 'Schema', link: '/guide/schema' },
                        { text: 'Migrations', link: '/guide/migrations' },
                        { text: 'Locks', link: '/guide/locks' },
                        { text: 'Errors', link: '/guide/errors' },
                        { text: 'Seeding', link: '/guide/seeding' },
                    ],
                },
                {
                    text: 'Recipes',
                    items: [
                        { text: 'Deploying with replicas', link: '/guide/recipes/deploy' },
                        { text: 'Drift check in CI', link: '/guide/recipes/drift-in-ci' },
                        { text: 'Testing', link: '/guide/recipes/testing' },
                        { text: 'Factories with relations', link: '/guide/recipes/factories-with-relations' },
                        { text: 'Running from a build', link: '/guide/recipes/production-build' },
                        { text: 'NestJS', link: '/guide/recipes/nestjs' },
                    ],
                },
                {
                    text: 'Help',
                    items: [
                        { text: 'Troubleshooting', link: '/guide/troubleshooting' },
                    ],
                },
                {
                    text: 'API Reference',
                    items: [
                        { text: 'Database', link: '/guide/database-api-reference' },
                        { text: 'DataSource', link: '/guide/datasource-api-reference' },
                        { text: 'Entity', link: '/guide/entity-api-reference' },
                        { text: 'Seeding', link: '/guide/seeding-api-reference' },
                    ],
                },
                {
                    text: 'Upgrading',
                    items: [
                        { text: 'Version 4', link: '/guide/migration-guide-v4' },
                        { text: 'Version 3', link: '/guide/migration-guide-v3' },
                    ],
                },
            ],
        },
    },
});
