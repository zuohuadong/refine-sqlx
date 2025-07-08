import { describe, it, expect } from 'vitest';
import { generateSort, generateFilter, mapOperator } from '../../src/utils';

describe('utils/index', () => {
    it('should export generateSort function', () => {
        expect(generateSort).toBeDefined();
        expect(typeof generateSort).toBe('function');
    });

    it('should export generateFilter function', () => {
        expect(generateFilter).toBeDefined();
        expect(typeof generateFilter).toBe('function');
    });

    it('should export mapOperator function', () => {
        expect(mapOperator).toBeDefined();
        expect(typeof mapOperator).toBe('function');
    });
});