/**
 * CRAFT - Interpreter Error Classes
 * Exception types for the Dalvik bytecode interpreter.
 */
export class InterpreterError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InterpreterError';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class NullPointerException extends InterpreterError {
    constructor(message?: string) {
        super(message || 'NullPointerException');
        this.name = 'NullPointerException';
    }
}
export class NoSuchMethodError extends InterpreterError {
    constructor(method: string) {
        super(`Method not found: ${method}`);
        this.name = 'NoSuchMethodError';
    }
}
export class AbstractMethodError extends InterpreterError {
    constructor(method: string) {
        super(`Abstract method called: ${method}`);
        this.name = 'AbstractMethodError';
    }
}
export class ClassNotFoundException extends InterpreterError {
    constructor(className: string) {
        super(`Class not found: ${className}`);
        this.name = 'ClassNotFoundException';
    }
}
export class VerifyError extends InterpreterError {
    constructor(message: string) {
        super(`Verification failed: ${message}`);
        this.name = 'VerifyError';
    }
}
export class ArrayIndexOutOfBoundsException extends InterpreterError {
    constructor(index: number) {
        super(`Array index out of bounds: ${index}`);
        this.name = 'ArrayIndexOutOfBoundsException';
    }
}
export class StringIndexOutOfBoundsException extends InterpreterError {
    constructor(index: number) {
        super(`String index out of bounds: ${index}`);
        this.name = 'StringIndexOutOfBoundsException';
    }
}
export class ArithmeticException extends InterpreterError {
    constructor(message: string) {
        super(message);
        this.name = 'ArithmeticException';
    }
}
export class IllegalArgumentException extends InterpreterError {
    constructor(message: string) {
        super(message);
        this.name = 'IllegalArgumentException';
    }
}
