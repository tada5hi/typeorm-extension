import { defineConfig } from 'vitepress';

export default defineConfig({
    title: 'typeorm-extension',
    base: '/',
    themeConfig: {
        socialLinks: [
            { icon: 'github', link: 'https://github.com/tada5hi/typeorm-extension' },
        ],
        editLink: {
            pattern: 'https://github.com/tada5hi/typeorm-extension/edit/master/docs/:path',
            text: 'Edit this page on GitHub'
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
            }
        ],
        sidebar: {
            '/guide/': [
                {
                    text: 'Introduction',
                    collapsible: false,
                    items: [
                        {text: 'What is it?', link: '/guide/'},
                    ]
                },
                {
                    text: 'Getting Started',
                    collapsible: false,
                    items: [
                        {text: 'Installation', link: '/guide/installation'},
                        {text: 'CLI', link: '/guide/cli'},
                        {text: 'Database', link: '/guide/database'},
                        {text: 'Instances', link: '/guide/instances'},
                        {text: 'Seeding', link: '/guide/seeding'},
                        {text: 'Query', link: '/guide/query'},
                    ]
                },
                {
                    text: 'API Reference',
                    collapsible: false,
                    items: [
                        {text: 'Database', link: '/guide/database-api-reference'},
                        {text: 'DataSource', link: '/guide/datasource-api-reference'},
                        {text: 'Seeding', link: '/guide/seeding-api-reference'},
                        {text: 'Query', link: '/guide/query-api-reference'},
                    ]
                },
            ]
        }
    }
});
