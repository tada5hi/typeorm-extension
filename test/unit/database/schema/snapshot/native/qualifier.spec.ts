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

    it('keeps the text whole where its quoting can not be read for sure', () => {
        // each would shift a naive literal split, and the own prefix inside the later literal would go
        const unreadable = [
            '([it\'s]<>\'dbo.x\')',
            '"A"<>\'x\' /* it\'s */ OR "A"=\'TEX.Y\'',
            '"A"<>q\'[it\'s TEX.Y]\'',
            '"A"<>N\'dbo.x\'',
            'a -- it\'s\n= \'dbo.x\'',
            '"it\'s"<>\'dbo.x\'',
            '`it\'s`<>\'dbo.x\'',
            'a = \'dbo.x',
        ];

        for (const text of unreadable) {
            expect(stripOwnQualifier(text, 'dbo')).toBe(text);
            expect(stripOwnQualifier(text, 'TEX')).toBe(text);
        }
    });

    it('reads doubled quotes and e-strings, and leaves a name inside an identifier', () => {
        expect(stripOwnQualifier('a = \'it\'\'s app.x\' AND app.f(a)', 'app')).toBe('a = \'it\'\'s app.x\' AND f(a)');
        expect(stripOwnQualifier('a = e\'it\\\'s app.x\' AND app.f(a)', 'app')).toBe('a = e\'it\\\'s app.x\' AND f(a)');
        expect(stripOwnQualifier('[a dbo.b] > 0', 'dbo')).toBe('[a dbo.b] > 0');
        expect(stripOwnQualifier('"x TEX.y" > 0', 'TEX')).toBe('"x TEX.y" > 0');
    });
});
