import { canReplaceWindowsSeparator, safeReplaceWindowsSeparator } from '../../../src';

describe('src/utils/separator.ts', () => {
    it('should replace windows separators', () => {
        expect(safeReplaceWindowsSeparator('src\\entities')).toEqual('src/entities');
    });

    it('should keep paths without windows separators untouched', () => {
        expect(safeReplaceWindowsSeparator('src/entities')).toEqual('src/entities');
    });

    it('should not replace within long-path prefixed input', () => {
        expect(canReplaceWindowsSeparator('\\\\?\\C:\\data')).toBeFalsy();
        expect(safeReplaceWindowsSeparator('\\\\?\\C:\\data')).toEqual('\\\\?\\C:\\data');
    });

    it('should not replace when a special character is escaped', () => {
        expect(canReplaceWindowsSeparator('src\\*.ts')).toBeFalsy();
    });
});
