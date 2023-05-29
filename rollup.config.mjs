/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import resolve from '@rollup/plugin-node-resolve';
import { transform } from "@swc/core";
import pkg from './package.json' assert {type: 'json'};
import path from "node:path";

const extensions = [
    '.js', '.jsx', '.ts', '.tsx',
];

const removeProcessDirectory = (input) => {
    if(!input) return;

    if(input.startsWith(process.cwd())) {
        return input.substring(process.cwd().length + 1);
    }

    return input;
}

const swc = () => {
    return {
        name: 'swc',
        transform(code) {
            return transform(code, {
                jsc: {
                    target: 'es2020',
                    parser: {
                        syntax: 'typescript'
                    },
                    loose: true
                },
                sourceMaps: true
            });
        }
    }
}

const external = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
    /^typeorm/,
]
export default [
    {
        input: './src/cli/index.ts',
        external,
        plugins: [
            {
                resolveId(source, importer, options) {
                    if(options.isEntry) {
                        return null;
                    }

                    if(importer) {
                        const importerRelative = removeProcessDirectory(importer);
                        if(!importerRelative.startsWith('src' + path.sep + 'cli')) {
                            return null;
                        }

                        if (source.indexOf('..') !== -1) {
                            return {
                                id: 'typeorm-extension',
                                external: true
                            }
                        }
                    }

                    return null;
                }
            },
            // Allows node_modules resolution
            resolve({ extensions}),

            // Compile TypeScript/JavaScript files
            swc()

        ],
        output: [
            {
                file: './bin/cli.cjs',
                format: 'cjs',
                banner: '#!/usr/bin/env node'
            }, {
                file: './bin/cli.mjs',
                format: 'esm',
                banner: '#!/usr/bin/env node'
            }
        ]
    },
    {
        input: './src/index.ts',

        // Specify here external modules which you don't want to include in your bundle (for instance: 'lodash', 'moment' etc.)
        // https://rollupjs.org/guide/en/#external
        external,

        plugins: [
            // Allows node_modules resolution
            resolve({ extensions}),

            // Compile TypeScript/JavaScript files
            swc()
        ],
        output: [
            {
                file: pkg.main,
                format: 'cjs',
                sourcemap: true
            }, {
                file: pkg.module,
                format: 'esm',
                sourcemap: true
            }
        ]
    }
];
