import { describe, expect, it } from 'vitest';
import { stripOwnQualifier } from '../../../../../../src/database/schema/snapshot/native/qualifier';

describe('database/schema/snapshot/native/qualifier', () => {
    it('removes the own schema in each quoting style', () => {
        expect(stripOwnQualifier('(st = \'b\'::rv_s1.st)', 'rv_s1')).toBe('(st = \'b\'::st)');
        expect(stripOwnQualifier('([rv_s1].[rv_f]([a]))', 'rv_s1')).toBe('([rv_f]([a]))');
        expect(stripOwnQualifier('"RV_A"."RV_F"("LABEL")', 'RV_A')).toBe('"RV_F"("LABEL")');
    });

    it('keeps another schema, a longer name and a string literal', () => {
        expect(stripOwnQualifier('other.f(a)', 'app')).toBe('other.f(a)');
        expect(stripOwnQualifier('my_app.f(a)', 'app')).toBe('my_app.f(a)');
        expect(stripOwnQualifier('t.app.f(a)', 'app')).toBe('t.app.f(a)');
        expect(stripOwnQualifier('a = \'app.x\' AND app.f(a)', 'app')).toBe('a = \'app.x\' AND f(a)');
    });
});
