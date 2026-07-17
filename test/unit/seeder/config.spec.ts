import { resolveSeederConfig } from '../../../src';

const SEEDS_DEFAULT = ['src/database/seeds/**/*{.ts,.js}'];
const FACTORIES_DEFAULT = ['src/database/factories/**/*{.ts,.js}'];

describe('src/seeder/config.ts', () => {
    it('should apply the built-in defaults when nothing is provided', () => {
        const config = resolveSeederConfig();

        expect(config).toEqual({
            seeds: SEEDS_DEFAULT,
            seedName: undefined,
            seedTableName: 'seeds',
            seedTracking: false,
            factories: FACTORIES_DEFAULT,
        });
    });

    describe('seeds', () => {
        it('should prefer input over data-source options and env', () => {
            const config = resolveSeederConfig(
                { seeds: ['input/seeds/*.ts'] },
                { seeds: ['ds/seeds/*.ts'] },
                { seeds: ['env/seeds/*.ts'], factories: [] },
            );

            expect(config.seeds).toEqual(['input/seeds/*.ts']);
        });

        it('should fall back to data-source options when input is empty', () => {
            let config = resolveSeederConfig(
                {},
                { seeds: ['ds/seeds/*.ts'] },
                { seeds: ['env/seeds/*.ts'], factories: [] },
            );
            expect(config.seeds).toEqual(['ds/seeds/*.ts']);

            config = resolveSeederConfig(
                { seeds: [] },
                { seeds: ['ds/seeds/*.ts'] },
            );
            expect(config.seeds).toEqual(['ds/seeds/*.ts']);
        });

        it('should fall back to env when input and data-source options are empty', () => {
            const config = resolveSeederConfig(
                {},
                {},
                { seeds: ['env/seeds/*.ts'], factories: [] },
            );

            expect(config.seeds).toEqual(['env/seeds/*.ts']);
        });

        it('should apply the built-in default last', () => {
            const config = resolveSeederConfig({}, {}, { seeds: [], factories: [] });

            expect(config.seeds).toEqual(SEEDS_DEFAULT);
        });
    });

    describe('factories', () => {
        it('should prefer input over data-source options and env', () => {
            const config = resolveSeederConfig(
                { factories: ['input/factories/*.ts'] },
                { factories: ['ds/factories/*.ts'] },
                { seeds: [], factories: ['env/factories/*.ts'] },
            );

            expect(config.factories).toEqual(['input/factories/*.ts']);
        });

        it('should fall back to data-source options when input is empty', () => {
            const config = resolveSeederConfig(
                { factories: [] },
                { factories: ['ds/factories/*.ts'] },
                { seeds: [], factories: ['env/factories/*.ts'] },
            );

            expect(config.factories).toEqual(['ds/factories/*.ts']);
        });

        it('should fall back to env when input and data-source options are empty', () => {
            const config = resolveSeederConfig(
                {},
                {},
                { seeds: [], factories: ['env/factories/*.ts'] },
            );

            expect(config.factories).toEqual(['env/factories/*.ts']);
        });

        it('should apply the built-in default last', () => {
            const config = resolveSeederConfig({}, {}, { seeds: [], factories: [] });

            expect(config.factories).toEqual(FACTORIES_DEFAULT);
        });
    });

    describe('seedName', () => {
        it('should only be taken from input', () => {
            let config = resolveSeederConfig({}, { seedName: 'FromDataSourceOptions' });
            expect(config.seedName).toBeUndefined();

            config = resolveSeederConfig(
                { seedName: 'FromInput' },
                { seedName: 'FromDataSourceOptions' },
            );
            expect(config.seedName).toEqual('FromInput');
        });
    });

    describe('seedTracking', () => {
        it('should prefer input over data-source options', () => {
            const config = resolveSeederConfig(
                { seedTracking: false },
                { seedTracking: true },
            );

            expect(config.seedTracking).toBe(false);
        });

        // characterization: the data-source options fallback is dead code —
        // the input value is defaulted to `false` before it is checked.
        it('should ignore data-source options when input is undefined (current behavior)', () => {
            const config = resolveSeederConfig({}, { seedTracking: true });

            expect(config.seedTracking).toBe(false);
        });

        it('should default to false', () => {
            const config = resolveSeederConfig();

            expect(config.seedTracking).toBe(false);
        });
    });

    describe('seedTableName', () => {
        it('should prefer input over data-source options', () => {
            const config = resolveSeederConfig(
                { seedTableName: 'input_seed_table' },
                { seedTableName: 'ds_seed_table' },
            );

            expect(config.seedTableName).toEqual('input_seed_table');
        });

        it('should fall back to data-source options', () => {
            const config = resolveSeederConfig({}, { seedTableName: 'ds_seed_table' });

            expect(config.seedTableName).toEqual('ds_seed_table');
        });

        it('should default to "seeds"', () => {
            const config = resolveSeederConfig();

            expect(config.seedTableName).toEqual('seeds');
        });
    });
});
