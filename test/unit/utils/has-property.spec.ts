import { hasOwnProperty, hasStringProperty } from '../../../src';

describe('src/utils/has-property.ts', () => {
    it('should detect own properties', () => {
        expect(hasOwnProperty({ a: 1 }, 'a')).toBeTruthy();
        expect(hasOwnProperty({ a: 1 }, 'b')).toBeFalsy();
    });

    it('should detect string properties', () => {
        expect(hasStringProperty({ a: 'x' }, 'a')).toBeTruthy();
        expect(hasStringProperty({ a: 1 }, 'a')).toBeFalsy();
        expect(hasStringProperty({}, 'a')).toBeFalsy();
    });
});
