import config from '@tada5hi/eslint-config';

export default [
    ...await config(),
    {
        rules: {
            'class-methods-use-this': 'off',
            'no-shadow': 'off',
            'no-use-before-define': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-use-before-define': 'off',
        },
    },
    {
        ignores: [
            'dist/**',
            'bin/**',
            'docs/.vitepress/cache/**',
            'docs/.vitepress/dist/**',
            '**/*.d.ts',
            '**/*.d.mts',
        ],
    },
];
