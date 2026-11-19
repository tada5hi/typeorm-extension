import {
    afterEach,
    describe,
    expect,
    it,
} from 'vitest';
import { EnvironmentVariableName, resetEnv, useEnv } from '../../../src/env';
import { splitEnvList } from '../../../src/env/list';

describe('src/env/list', () => {
    describe('splitEnvList', () => {
        it('should split at commas', () => {
            expect(splitEnvList('a,b,c')).toEqual(['a', 'b', 'c']);
        });

        it('should keep a brace group together', () => {
            expect(splitEnvList('src/seeds/**/*{.ts,.js}')).toEqual(['src/seeds/**/*{.ts,.js}']);
        });

        it('should split between patterns with brace groups', () => {
            expect(splitEnvList('src/a/*{.ts,.js},src/b/*{.ts,.js}')).toEqual([
                'src/a/*{.ts,.js}',
                'src/b/*{.ts,.js}',
            ]);
        });

        it('should keep nested brace groups together', () => {
            expect(splitEnvList('src/{a,b/{c,d}}/*.ts,src/e.ts')).toEqual([
                'src/{a,b/{c,d}}/*.ts',
                'src/e.ts',
            ]);
        });

        it('should trim entries and drop empty ones', () => {
            expect(splitEnvList(' a , ,b,, ')).toEqual(['a', 'b']);
            expect(splitEnvList('')).toEqual([]);
        });

        it('should not count an escaped brace as a group', () => {
            expect(splitEnvList('src/legacy\\{/*.ts,src/current/*.ts')).toEqual([
                'src/legacy\\{/*.ts',
                'src/current/*.ts',
            ]);
            expect(splitEnvList('src/\\{a,b\\}.ts')).toEqual(['src/\\{a', 'b\\}.ts']);
        });

        it('should not count a brace in a character class as a group', () => {
            expect(splitEnvList('src/[{]/*.ts,src/current/*.ts')).toEqual([
                'src/[{]/*.ts',
                'src/current/*.ts',
            ]);
            expect(splitEnvList('src/[}]/*.ts,src/a/*{.ts,.js}')).toEqual([
                'src/[}]/*.ts',
                'src/a/*{.ts,.js}',
            ]);
        });

        it('should keep a comma in a character class', () => {
            expect(splitEnvList('src/[,]*.ts,src/b.ts')).toEqual(['src/[,]*.ts', 'src/b.ts']);
        });

        it('should keep a POSIX class inside its character class', () => {
            expect(splitEnvList('src/[[:alpha:],]*.ts,src/b.ts')).toEqual(['src/[[:alpha:],]*.ts', 'src/b.ts']);
        });

        it('should treat an unclosed character class as literal', () => {
            expect(splitEnvList('src/[a,src/b.ts')).toEqual(['src/[a', 'src/b.ts']);
        });

        it('should not let a stray closing brace swallow later commas', () => {
            expect(splitEnvList('a},b,c')).toEqual(['a}', 'b', 'c']);
        });
    });

    describe('useEnv', () => {
        const names = [
            EnvironmentVariableName.SEEDS,
            EnvironmentVariableName.SEEDS_ALT,
            EnvironmentVariableName.FACTORIES,
            EnvironmentVariableName.FACTORIES_ALT,
            EnvironmentVariableName.ENTITIES,
            EnvironmentVariableName.ENTITIES_ALT,
            EnvironmentVariableName.MIGRATIONS,
            EnvironmentVariableName.MIGRATIONS_ALT,
            EnvironmentVariableName.SUBSCRIBERS,
            EnvironmentVariableName.SUBSCRIBERS_ALT,
        ];

        afterEach(() => {
            for (const name of names) {
                delete process.env[name];
            }

            resetEnv();
        });

        it.each([
            [EnvironmentVariableName.SEEDS, 'seeds'],
            [EnvironmentVariableName.SEEDS_ALT, 'seeds'],
            [EnvironmentVariableName.FACTORIES, 'factories'],
            [EnvironmentVariableName.FACTORIES_ALT, 'factories'],
            [EnvironmentVariableName.ENTITIES, 'entities'],
            [EnvironmentVariableName.ENTITIES_ALT, 'entities'],
            [EnvironmentVariableName.MIGRATIONS, 'migrations'],
            [EnvironmentVariableName.MIGRATIONS_ALT, 'migrations'],
            [EnvironmentVariableName.SUBSCRIBERS, 'subscribers'],
            [EnvironmentVariableName.SUBSCRIBERS_ALT, 'subscribers'],
        ] as const)('should keep brace groups of %s together', (name, key) => {
            process.env[name] = 'src/a/**/*{.ts,.js}, src/b/*.ts';
            resetEnv();

            expect(useEnv(key)).toEqual(['src/a/**/*{.ts,.js}', 'src/b/*.ts']);
        });

        it('should prefer the DB_* name over its alias', () => {
            process.env[EnvironmentVariableName.SEEDS] = 'a/*{.ts,.js}';
            process.env[EnvironmentVariableName.SEEDS_ALT] = 'b/*.ts';
            resetEnv();

            expect(useEnv('seeds')).toEqual(['a/*{.ts,.js}']);
        });

        it('should give an empty list for an unset variable', () => {
            resetEnv();

            expect(useEnv('seeds')).toEqual([]);
            expect(useEnv('entities')).toEqual([]);
        });
    });
});
