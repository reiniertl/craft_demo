/**
 * Base error class for all CRAFT errors.
 */
export class CraftError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'CraftError';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
/**
 * Errors during file format parsing.
 */
export class ParseError extends CraftError {
    constructor(message: string, public readonly offset?: number) {
        super(message, 'PARSE_ERROR');
        this.name = 'ParseError';
    }
}
/**
 * Errors during data validation.
 */
export class ValidationError extends CraftError {
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}
/**
 * Errors when required data is not found.
 */
export class NotFoundError extends CraftError {
    constructor(message: string) {
        super(message, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}
