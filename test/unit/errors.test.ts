import { CraftError, ParseError, ValidationError, NotFoundError } from '../../src/core/errors';

describe('Error types', () => {
    test('CraftError has correct properties', () => {
        const error = new CraftError('test message', 'TEST_CODE');
        expect(error.message).toBe('test message');
        expect(error.code).toBe('TEST_CODE');
        expect(error.name).toBe('CraftError');
        expect(error instanceof Error).toBe(true);
    });

    test('ParseError has correct properties', () => {
        const error = new ParseError('parse error', 100);
        expect(error.message).toBe('parse error');
        expect(error.code).toBe('PARSE_ERROR');
        expect(error.offset).toBe(100);
        expect(error.name).toBe('ParseError');
        expect(error instanceof CraftError).toBe(true);
    });

    test('ParseError without offset', () => {
        const error = new ParseError('parse error');
        expect(error.offset).toBeUndefined();
    });

    test('ValidationError has correct properties', () => {
        const error = new ValidationError('validation error');
        expect(error.message).toBe('validation error');
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.name).toBe('ValidationError');
        expect(error instanceof CraftError).toBe(true);
    });

    test('NotFoundError has correct properties', () => {
        const error = new NotFoundError('not found');
        expect(error.message).toBe('not found');
        expect(error.code).toBe('NOT_FOUND');
        expect(error.name).toBe('NotFoundError');
        expect(error instanceof CraftError).toBe(true);
    });
});
