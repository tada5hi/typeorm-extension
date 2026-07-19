import { extendObject, pickRecord } from '../../../src';

describe('src/utils/object.ts', () => {
    it('should pick keys of a record', () => {
        expect(pickRecord({
            a: 1, 
            b: 2, 
            c: 3, 
        }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });

    it('should extend an object', () => {
        const target = { a: 1, b: 2 };

        expect(extendObject(target, { b: 3 })).toBe(target);
        expect(target.b).toEqual(3);
    });
});
