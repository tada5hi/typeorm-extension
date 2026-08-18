import { describe, expect, it } from 'vitest';
import { hasTrailingSlash, withoutTrailingSlash } from '../../../src';

describe('src/utils/slash.ts', () => {
    it('should detect a trailing slash', () => {
        expect(hasTrailingSlash('dist/')).toBeTruthy();
        expect(hasTrailingSlash('dist')).toBeFalsy();
        expect(hasTrailingSlash('dist/?sort=id', true)).toBeTruthy();
    });

    it('should strip a trailing slash', () => {
        expect(withoutTrailingSlash('dist/')).toEqual('dist');
        expect(withoutTrailingSlash('dist')).toEqual('dist');
        expect(withoutTrailingSlash('/')).toEqual('/');
        expect(withoutTrailingSlash('')).toEqual('/');
    });

    it('should strip a trailing slash before query parameters', () => {
        expect(withoutTrailingSlash('dist/?sort=id', true)).toEqual('dist?sort=id');
        expect(withoutTrailingSlash('dist?sort=id', true)).toEqual('dist?sort=id');
        expect(withoutTrailingSlash('/?sort=id', true)).toEqual('/?sort=id');
    });
});
