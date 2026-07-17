import { AsyncKeyedCache } from '../../../src/runtime';

describe('src/runtime/cache.ts', () => {
    it('should set, get and unset values', () => {
        const cache = new AsyncKeyedCache<string>();

        expect(cache.has('foo')).toBeFalsy();
        expect(cache.get('foo')).toBeUndefined();

        cache.set('foo', 'bar');

        expect(cache.has('foo')).toBeTruthy();
        expect(cache.get('foo')).toEqual('bar');
        expect(cache.has('baz')).toBeFalsy();

        cache.unset('foo');

        expect(cache.has('foo')).toBeFalsy();
    });

    it('should build and store a missing value', async () => {
        const cache = new AsyncKeyedCache<string>();

        const value = await cache.resolve('foo', async () => 'bar');

        expect(value).toEqual('bar');
        expect(cache.has('foo')).toBeTruthy();
        expect(cache.get('foo')).toEqual('bar');
    });

    it('should pass the existing value to the build callback', async () => {
        const cache = new AsyncKeyedCache<string>();
        cache.set('foo', 'bar');

        const value = await cache.resolve('foo', async (existing) => existing || 'baz');

        expect(value).toEqual('bar');
    });

    it('should build once for concurrent calls', async () => {
        const cache = new AsyncKeyedCache<number>();

        let calls = 0;
        const build = async () => {
            calls++;
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
            return calls;
        };

        const [first, second] = await Promise.all([
            cache.resolve('foo', build),
            cache.resolve('foo', build),
        ]);

        expect(calls).toEqual(1);
        expect(first).toEqual(1);
        expect(second).toEqual(1);
    });

    it('should isolate values by key', async () => {
        const cache = new AsyncKeyedCache<string>();

        await cache.resolve('foo', async () => 'foo-value');
        await cache.resolve('bar', async () => 'bar-value');

        expect(cache.get('foo')).toEqual('foo-value');
        expect(cache.get('bar')).toEqual('bar-value');

        cache.unset('foo');

        expect(cache.has('foo')).toBeFalsy();
        expect(cache.has('bar')).toBeTruthy();
    });

    it('should evict a failed build and retry', async () => {
        const cache = new AsyncKeyedCache<string>();

        let calls = 0;
        const build = async () => {
            calls++;
            if (calls === 1) {
                throw new Error('boom');
            }

            return 'bar';
        };

        await expect(cache.resolve('foo', build)).rejects.toThrow('boom');
        expect(cache.has('foo')).toBeFalsy();

        const value = await cache.resolve('foo', build);
        expect(value).toEqual('bar');
        expect(calls).toEqual(2);
    });

    it('should resolve with the replacement after set', async () => {
        const cache = new AsyncKeyedCache<string>();

        cache.set('foo', 'bar');

        const value = await cache.resolve('foo', async (existing) => existing as string);
        expect(value).toEqual('bar');

        cache.set('foo', 'baz');

        const next = await cache.resolve('foo', async (existing) => existing as string);
        expect(next).toEqual('baz');
    });

    it('should clear all values and pending builds', async () => {
        const cache = new AsyncKeyedCache<string>();

        await cache.resolve('foo', async () => 'bar');
        cache.set('baz', 'qux');

        cache.clear();

        expect(cache.has('foo')).toBeFalsy();
        expect(cache.has('baz')).toBeFalsy();
    });
});
